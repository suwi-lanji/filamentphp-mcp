#!/usr/bin/env node

/**
 * FilamentPHP MCP Server
 *
 * An MCP server that provides AI agents with access to FilamentPHP v5.x documentation,
 * component references, and API information. Uses in-memory pre-processed index
 * with TF-IDF keyword search — no external databases required.
 *
 * FilamentPHP: https://filamentphp.com/
 * - Admin panels, forms, tables, and more for Laravel
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as path from "path";
import * as fs from "fs";
import { loadDocs, getDocByPath, getFilesInSection } from "./docs-loader.js";
import { DocsSearchEngine } from "./docs-search.js";
import type { DocsIndex } from "./types.js";

// ─── Locate Docs ──────────────────────────────────────────────────────────────

/**
 * Resolve the docs directory path.
 * Checks multiple locations in order of preference.
 */
function resolveDocsDir(): string {
  // 1. DOCS_DIR env var
  if (process.env.DOCS_DIR) {
    const dir = path.resolve(process.env.DOCS_DIR);
    if (fs.existsSync(dir)) return dir;
  }

  // 2. Local docs directory (for development with cloned repo)
  const localDocs = path.resolve(__dirname, "..", "filamentphp-repo", "docs");
  if (fs.existsSync(localDocs)) return localDocs;

  // 3. As an npm package, look for docs in package root
  const pkgRoot = path.resolve(__dirname, "..", "docs");
  if (fs.existsSync(pkgRoot)) return pkgRoot;

  throw new Error(
    "Could not find FilamentPHP docs directory. Set DOCS_DIR env var or place docs at ./filamentphp-repo/docs/"
  );
}

// ─── Initialize ───────────────────────────────────────────────────────────────

let docsIndex: DocsIndex;
let searchEngine: DocsSearchEngine;

function initialize(): void {
  const docsDir = resolveDocsDir();
  console.error(`Loading docs from: ${docsDir}`);
  docsIndex = loadDocs(docsDir);
  searchEngine = new DocsSearchEngine(docsIndex);
  console.error(
    `Indexed ${docsIndex.chunks.length} chunks from ${docsIndex.sections.length} sections (${docsIndex.totalWords} words)`
  );
}

// ─── Create MCP Server ───────────────────────────────────────────────────────

const server = new McpServer({
  name: "filamentphp-mcp",
  version: "1.0.0",
});

// ─── Tool 1: Health Check ─────────────────────────────────────────────────────

server.tool(
  "filamentphp_health",
  "Health check for the FilamentPHP MCP server. Returns server status, version, and index statistics.",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "healthy",
              server: "filamentphp-mcp",
              version: "1.0.0",
              description: "MCP server for accessing FilamentPHP v5.x documentation",
              filamentphp_version: "v5.x",
              index: {
                sections: docsIndex.sections.length,
                chunks: docsIndex.chunks.length,
                totalWords: docsIndex.totalWords,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool 2: List Docs Sections ───────────────────────────────────────────────

server.tool(
  "list_docs_sections",
  "List all documentation sections with their IDs, names, and file counts. Use this to discover what documentation is available before searching or reading specific docs.",
  {},
  async () => {
    const sections = docsIndex.sections.map((s) => ({
      id: s.id,
      name: s.name,
      fileCount: s.files.length,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ sections }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool 3: List Docs in Section ─────────────────────────────────────────────

server.tool(
  "list_docs_in_section",
  "List all documentation files within a specific section. Use list_docs_sections first to get the section IDs.",
  {
    sectionId: z
      .string()
      .describe(
        "The section ID (e.g., '01-introduction', '03-resources', '12-components'). Use list_docs_sections to see all available IDs."
      ),
  },
  async ({ sectionId }) => {
    const files = getFilesInSection(resolveDocsDir(), sectionId);

    if (files.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `No section found with ID '${sectionId}' or section is empty.`,
                hint: "Use the list_docs_sections tool to see all available section IDs.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const fileSummaries = files.map((f) => {
      // Try to load title from the file
      const doc = getDocByPath(resolveDocsDir(), f.relativePath);
      return {
        path: f.relativePath,
        title: doc?.title || path.basename(f.relativePath),
      };
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              sectionId,
              fileCount: fileSummaries.length,
              files: fileSummaries,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool 4: Search FilamentPHP Docs ──────────────────────────────────────────

server.tool(
  "search_filamentphp_docs",
  "Search the full FilamentPHP documentation using keyword search. Returns ranked results with relevant snippets and source file paths. Great for finding specific components, configuration options, code examples, or explanations.",
  {
    query: z
      .string()
      .describe(
        "The search query. Use specific terms for best results. Examples: 'TextInput validation', 'table columns filter', 'relation manager', 'FileUpload', 'custom page', 'Repeater component', 'panel configuration', 'tenancy setup'"
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Maximum number of results to return (default: 5, max: 20)."),
  },
  async ({ query, limit }) => {
    const results = searchEngine.search(query, limit || 5);

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query,
                resultCount: 0,
                message: "No matching documentation found. Try different search terms or browse sections using list_docs_sections.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const formatted = results.map((r) => ({
      score: r.score,
      matchedTerms: r.matchedTerms,
      file: r.chunk.file.relativePath,
      heading: r.chunk.heading,
      snippet: r.snippet,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              query,
              resultCount: results.length,
              results: formatted,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool 5: Get FilamentPHP Doc ──────────────────────────────────────────────

server.tool(
  "get_filamentphp_doc",
  "Read the full content of a specific documentation file by its relative path. Use list_docs_in_section to find available paths. Returns the complete pre-processed markdown content.",
  {
    path: z
      .string()
      .describe(
        "The relative path to the documentation file (e.g., '03-resources/01-overview.md', '12-components/02-form.md', '01-introduction/02-installation.md'). Use list_docs_in_section to see available paths."
      ),
  },
  async ({ path: docPath }) => {
    const doc = getDocByPath(resolveDocsDir(), docPath);

    if (!doc) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `Documentation file not found: '${docPath}'`,
                hint: "Use list_docs_sections and list_docs_in_section to discover available documentation paths.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Truncate extremely long docs to stay within MCP message limits
    const maxContentLength = 30000;
    const content =
      doc.content.length > maxContentLength
        ? doc.content.slice(0, maxContentLength) +
          "\n\n[... Content truncated. Use search_filamentphp_docs for specific topics.]"
        : doc.content;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              title: doc.title,
              path: docPath,
              contentLength: doc.content.length,
              content,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Start Server ─────────────────────────────────────────────────────────────

async function main() {
  initialize();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FilamentPHP MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Export for testing
export { resolveDocsDir };
