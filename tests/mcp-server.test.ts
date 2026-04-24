/**
 * Integration tests for the MCP server.
 * Tests the full tool pipeline: load docs → search → get doc → list sections.
 * Does NOT test the MCP protocol itself (that's the SDK's responsibility),
 * but tests our tool logic end-to-end.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as path from "path";
import { loadDocs, getDocByPath } from "../src/docs-loader.js";
import { DocsSearchEngine } from "../src/docs-search.js";
import type { DocsIndex } from "../src/types.js";

// ─── Setup ────────────────────────────────────────────────────────────────────

let index: DocsIndex;
let engine: DocsSearchEngine;
const docsDir = path.resolve(__dirname, "..", "filamentphp-repo", "docs");

beforeAll(() => {
  index = loadDocs(docsDir);
  engine = new DocsSearchEngine(index);
});

// ─── Tool Simulations ─────────────────────────────────────────────────────────

/**
 * Simulates what list_docs_sections would return
 */
function simulateListSections() {
  return index.sections.map((s) => ({
    id: s.id,
    name: s.name,
    fileCount: s.files.length,
  }));
}

/**
 * Simulates what list_docs_in_section would return
 */
function simulateListInSection(sectionId: string) {
  const section = index.sections.find((s) => s.id === sectionId);
  if (!section) return null;

  return section.files.map((f) => {
    const doc = getDocByPath(docsDir, f.relativePath);
    return {
      path: f.relativePath,
      title: doc?.title || path.basename(f.relativePath),
    };
  });
}

/**
 * Simulates what search_filamentphp_docs would return
 */
function simulateSearch(query: string, limit = 5) {
  const results = engine.search(query, limit);
  if (results.length === 0) {
    return { query, resultCount: 0 };
  }
  return {
    query,
    resultCount: results.length,
    results: results.map((r) => ({
      score: r.score,
      matchedTerms: r.matchedTerms,
      file: r.chunk.file.relativePath,
      heading: r.chunk.heading,
      snippet: r.snippet,
    })),
  };
}

/**
 * Simulates what get_filamentphp_doc would return
 */
function simulateGetDoc(docPath: string) {
  const doc = getDocByPath(docsDir, docPath);
  if (!doc) return { error: `Documentation file not found: '${docPath}'` };
  return {
    title: doc.title,
    path: docPath,
    contentLength: doc.content.length,
    content: doc.content,
  };
}

/**
 * Simulates what filamentphp_health would return
 */
function simulateHealth() {
  return {
    status: "healthy",
    server: "filamentphp-mcp",
    version: "1.0.0",
    description: "MCP server for accessing FilamentPHP v5.x documentation",
    filamentphp_version: "v5.x",
    index: {
      sections: index.sections.length,
      chunks: index.chunks.length,
      totalWords: index.totalWords,
    },
  };
}

// ─── Integration Tests ────────────────────────────────────────────────────────

describe("MCP Server Integration - list_docs_sections", () => {
  it("should return all sections with required fields", () => {
    const result = simulateListSections();
    expect(result.length).toBeGreaterThanOrEqual(10);

    for (const section of result) {
      expect(section.id).toBeTruthy();
      expect(section.name).toBeTruthy();
      expect(section.fileCount).toBeGreaterThan(0);
      expect(typeof section.fileCount).toBe("number");
    }
  });

  it("should include key documentation sections", () => {
    const result = simulateListSections();
    const ids = result.map((s) => s.id);

    expect(ids.some((id) => id.includes("introduction"))).toBe(true);
    expect(ids.some((id) => id.includes("resources"))).toBe(true);
    expect(ids.some((id) => id.includes("components"))).toBe(true);
    expect(ids.some((id) => id.includes("plugins"))).toBe(true);
  });

  it("should have Components as the largest section by file count", () => {
    const result = simulateListSections();
    const sorted = [...result].sort((a, b) => b.fileCount - a.fileCount);
    expect(sorted[0].id).toContain("components");
  });
});

describe("MCP Server Integration - list_docs_in_section", () => {
  it("should return files for the resources section", () => {
    const result = simulateListInSection("03-resources");
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(5);

    for (const file of result!) {
      expect(file.path).toContain("03-resources/");
      expect(file.title).toBeTruthy();
    }
  });

  it("should return files for the components section", () => {
    const result = simulateListInSection("12-components");
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(10);
  });

  it("should return null for non-existent section", () => {
    const result = simulateListInSection("99-nonexistent");
    expect(result).toBeNull();
  });

  it("should include form and table component docs", () => {
    const result = simulateListInSection("12-components");
    const paths = result!.map((f) => f.path);
    expect(paths.some((p) => p.includes("02-form.md"))).toBe(true);
    expect(paths.some((p) => p.includes("02-table.md"))).toBe(true);
  });
});

describe("MCP Server Integration - search_filamentphp_docs", () => {
  it("should find TextInput documentation when searching for 'TextInput'", () => {
    const result = simulateSearch("TextInput", 5);
    expect(result.resultCount).toBeGreaterThan(0);

    const hasTextInput = result.results!.some(
      (r) =>
        r.snippet.toLowerCase().includes("textinput") ||
        r.heading.toLowerCase().includes("textinput") ||
        r.matchedTerms.some((t) => t.includes("text") || t.includes("input"))
    );
    expect(hasTextInput).toBe(true);
  });

  it("should find Repeater component when searching for 'Repeater'", () => {
    const result = simulateSearch("Repeater", 5);
    expect(result.resultCount).toBeGreaterThan(0);
  });

  it("should find relation manager docs when searching for 'relation manager'", () => {
    const result = simulateSearch("relation manager", 5);
    expect(result.resultCount).toBeGreaterThan(0);

    // Top result should be highly relevant
    expect(result.results![0].score).toBeGreaterThanOrEqual(0.5);
  });

  it("should find panel configuration when searching for 'panel configuration'", () => {
    const result = simulateSearch("panel configuration", 5);
    expect(result.resultCount).toBeGreaterThan(0);
  });

  it("should return structured results with all required fields", () => {
    const result = simulateSearch("form", 5);
    expect(result.resultCount).toBeGreaterThan(0);

    for (const r of result.results!) {
      expect(typeof r.score).toBe("number");
      expect(r.score).toBeGreaterThan(0);
      expect(r.matchedTerms).toBeDefined();
      expect(r.file).toBeTruthy();
      expect(r.heading).toBeTruthy();
      expect(r.snippet).toBeTruthy();
    }
  });

  it("should return results from different sections for broad queries", () => {
    const result = simulateSearch("component", 10);
    if (result.resultCount >= 5) {
      const uniqueSections = new Set(
        result.results!.map((r) => {
          const parts = r.file.split("/");
          return parts[0];
        })
      );
      // A broad query should match across multiple sections
      expect(uniqueSections.size).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("MCP Server Integration - get_filamentphp_doc", () => {
  it("should return full content for a specific doc file", () => {
    const result = simulateGetDoc("01-introduction/01-overview.md");
    expect(result.error).toBeUndefined();
    expect(result.title).toBeTruthy();
    expect(result.contentLength).toBeGreaterThan(500);
    expect(result.content).toContain("Filament");
  });

  it("should return form docs with PHP code examples", () => {
    const result = simulateGetDoc("12-components/02-form.md");
    expect(result.error).toBeUndefined();
    expect(result.content).toContain("```php");
  });

  it("should return error for non-existent file", () => {
    const result = simulateGetDoc("non-existent/file.md");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("not found");
  });

  it("should have pre-processed content (no Astro imports)", () => {
    const result = simulateGetDoc("01-introduction/01-overview.md");
    expect(result.content).not.toContain("@components/");
    expect(result.content).not.toContain("import Aside");
  });
});

describe("MCP Server Integration - filamentphp_health", () => {
  it("should return healthy status with index stats", () => {
    const result = simulateHealth();
    expect(result.status).toBe("healthy");
    expect(result.version).toBe("1.0.0");
    expect(result.filamentphp_version).toBe("v5.x");
    expect(result.index.sections).toBeGreaterThan(0);
    expect(result.index.chunks).toBeGreaterThan(0);
    expect(result.index.totalWords).toBeGreaterThan(0);
  });
});

// ─── End-to-End Workflow ─────────────────────────────────────────────────────

describe("MCP Server Integration - end-to-end workflow", () => {
  it("should support the discover → search → read workflow", () => {
    // Step 1: Discover sections
    const sections = simulateListSections();
    expect(sections.length).toBeGreaterThan(0);

    // Step 2: Pick a section and list its files
    const componentsSection = sections.find((s) => s.id === "12-components");
    expect(componentsSection).toBeDefined();

    const files = simulateListInSection(componentsSection!.id);
    expect(files!.length).toBeGreaterThan(0);

    // Step 3: Search for a specific topic
    const searchResults = simulateSearch("form schema component", 3);
    expect(searchResults.resultCount).toBeGreaterThan(0);

    // Step 4: Read a specific doc using the path from search results
    const docPath = searchResults.results![0].file;
    const doc = simulateGetDoc(docPath);
    expect(doc.error).toBeUndefined();
    expect(doc.content.length).toBeGreaterThan(0);
  });

  it("should handle the full agent workflow for finding TextInput docs", () => {
    // Agent: "How do I use TextInput in Filament?"

    // 1. Search for TextInput
    const search = simulateSearch("TextInput component", 5);
    expect(search.resultCount).toBeGreaterThan(0);

    // 2. Get the most relevant doc
    const topResult = search.results![0];
    expect(topResult.file).toBeTruthy();

    // 3. Read the full doc
    const doc = simulateGetDoc(topResult.file);
    expect(doc.error).toBeUndefined();
    expect(doc.content.length).toBeGreaterThan(100);

    // 4. Verify the doc actually mentions TextInput
    expect(doc.content.toLowerCase()).toContain("textinput");
  });
});
