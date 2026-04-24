/**
 * Docs loader - reads FilamentPHP markdown docs from disk,
 * pre-processes them (strips Astro, extracts frontmatter),
 * and splits them into searchable chunks at ## headings.
 */

import * as fs from "fs";
import * as path from "path";
import type { DocChunk, DocFile, DocSection, DocsIndex } from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Mapping of section directory names to human-readable names */
const SECTION_NAMES: Record<string, string> = {
  "01-introduction": "Introduction",
  "02-getting-started.md": "Getting Started",
  "03-resources": "Resources",
  "04-_PACKAGES": "Packages",
  "05-panel-configuration.md": "Panel Configuration",
  "06-navigation": "Navigation",
  "07-users": "Users",
  "08-styling": "Styling",
  "09-advanced": "Advanced",
  "10-testing": "Testing",
  "11-plugins": "Plugins",
  "12-components": "Components",
  "13-deployment.md": "Deployment",
  "14-upgrade-guide.md": "Upgrade Guide",
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load all documentation from the given docs directory.
 * Returns a fully pre-processed index ready for search.
 */
export function loadDocs(docsDir: string): DocsIndex {
  const absDir = path.resolve(docsDir);
  if (!fs.existsSync(absDir)) {
    throw new Error(`Docs directory not found: ${absDir}`);
  }

  const sections = scanSections(absDir);
  const chunks: DocChunk[] = [];
  let totalWords = 0;

  for (const section of sections) {
    for (const file of section.files) {
      const raw = fs.readFileSync(file.absolutePath, "utf-8");
      const { frontmatter, content } = extractFrontmatter(raw);
      const cleaned = stripAstroComponents(content);
      const title = frontmatter.title || extractTitle(cleaned);

      // Populate the file title in the section's file list
      const sectionFile = section.files.find((f) => f.absolutePath === file.absolutePath);
      if (sectionFile) sectionFile.title = title;

      const fileChunks = splitIntoChunks(cleaned, { ...file, title }, frontmatter);

      for (const chunk of fileChunks) {
        chunk.wordCount = countWords(chunk.content);
        totalWords += chunk.wordCount;
      }

      chunks.push(...fileChunks);
    }
  }

  return { sections, chunks, totalWords };
}

/**
 * Get a specific doc file by its relative path (e.g., "03-resources/01-overview.md").
 * Returns the pre-processed markdown content.
 */
export function getDocByPath(
  docsDir: string,
  relativePath: string
): { title: string; content: string; raw: string } | null {
  const absPath = path.resolve(docsDir, relativePath);
  if (!fs.existsSync(absPath)) return null;

  const raw = fs.readFileSync(absPath, "utf-8");
  const { frontmatter, content } = extractFrontmatter(raw);
  const title = frontmatter.title || extractTitle(content);
  const cleaned = stripAstroComponents(content);

  return { title, content: cleaned, raw };
}

/**
 * List all files in a specific section.
 */
export function getFilesInSection(
  docsDir: string,
  sectionId: string
): DocFile[] {
  const absDir = path.resolve(docsDir);
  const sections = scanSections(absDir);
  const section = sections.find((s) => s.id === sectionId);
  return section?.files ?? [];
}

// ─── Scanning ────────────────────────────────────────────────────────────────

function scanSections(absDir: string): DocSection[] {
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const sections: DocSection[] = [];

  // Sort entries to maintain order: 01, 02, 03, ...
  const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sorted) {
    const key = entry.name;

    // Skip hidden files and non-doc entries
    if (key.startsWith(".") || key === "04-_PACKAGES") continue;

    if (entry.isDirectory()) {
      const dirPath = path.join(absDir, key);
      const files = scanMarkdownFiles(dirPath, key);
      if (files.length > 0) {
        sections.push({
          id: key,
          name: SECTION_NAMES[key] || key,
          files,
        });
      }
    } else if (entry.isFile() && key.endsWith(".md")) {
      const sectionKey = key.replace(/\.md$/, "");
      sections.push({
        id: key,
        name: SECTION_NAMES[key] || sectionKey,
        files: [
          {
            absolutePath: path.join(absDir, key),
            relativePath: key,
            title: "",
          },
        ],
      });
    }
  }

  return sections;
}

function scanMarkdownFiles(dirPath: string, sectionDir: string): DocFile[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: DocFile[] = [];

  const sorted = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sorted) {
    const relativePath = path.join(sectionDir, entry.name);
    files.push({
      absolutePath: path.join(dirPath, entry.name),
      relativePath,
      title: "",
    });
  }

  return files;
}

// ─── Pre-processing ──────────────────────────────────────────────────────────

interface Frontmatter {
  title?: string;
  [key: string]: string | boolean | undefined;
}

/**
 * Extract YAML frontmatter from the top of a markdown file.
 * Returns the parsed frontmatter and the remaining content.
 */
export function extractFrontmatter(
  raw: string
): { frontmatter: Frontmatter; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, content: raw };
  }

  const frontmatterStr = match[1];
  const content = match[2];
  const frontmatter: Frontmatter = {};

  for (const line of frontmatterStr.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();

    // Strip quotes from string values
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Handle boolean values
    if (value === "true") {
      (frontmatter as Record<string, unknown>)[key] = true;
    } else if (value === "false") {
      (frontmatter as Record<string, unknown>)[key] = false;
    } else {
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content };
}

/**
 * Strip Astro component imports and convert <Aside> components to plain text.
 */
export function stripAstroComponents(markdown: string): string {
  let result = markdown;

  // Remove Astro import statements
  result = result.replace(/^import .+ from ["']@components\/.+\s*$/gm, "");

  // Convert <Aside variant="...">content</Aside> to blockquotes with a tag prefix
  const asideVariants: Record<string, string> = {
    tip: "TIP",
    info: "INFO",
    warning: "WARNING",
    danger: "DANGER",
  };

  result = result.replace(
    /<Aside\s+variant=["'](\w+)["']\s*>([\s\S]*?)<\/Aside>/g,
    (_match, variant: string, content: string) => {
      const tag = asideVariants[variant.toLowerCase()] || variant.toUpperCase();
      const trimmedContent = content.trim();
      // Indent each line of the content as a blockquote
      const quoted = trimmedContent
        .split("\n")
        .map((line: string) => `> ${line}`)
        .join("\n");
      return `> [${tag}] ${quoted.replace(/^> /, "")}`;
    }
  );

  // Convert <Disclosure>...</Disclosure> blocks - extract summary and content
  result = result.replace(
    /<Disclosure>\s*<span\s+slot=["']summary["']>([\s\S]*?)<\/span>\s*([\s\S]*?)<\/Disclosure>/g,
    (_match, summary: string, content: string) => {
      const summaryText = summary.trim();
      const bodyText = content.trim();
      return `**${summaryText}**\n\n${bodyText}`;
    }
  );

  // Remove any remaining Astro-style component tags that weren't handled
  result = result.replace(/<\/?(Aside|Disclosure|Section|CodeBlock)[^>]*>/g, "");

  // Clean up excessive blank lines (more than 2 consecutive)
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

// ─── Chunking ────────────────────────────────────────────────────────────────

/**
 * Split markdown content into chunks at ## (H2) heading boundaries.
 * Each chunk contains the heading and its content up to the next ## heading.
 */
export function splitIntoChunks(
  markdown: string,
  file: DocFile,
  frontmatter: Frontmatter = {}
): DocChunk[] {
  const lines = markdown.split("\n");
  const chunks: DocChunk[] = [];

  // Find all ## heading positions
  const headingPositions: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^##\s+/)) {
      headingPositions.push(i);
    }
  }

  if (headingPositions.length === 0) {
    // No ## headings — the entire file is one chunk
    const title = frontmatter.title || extractTitle(markdown);
    chunks.push({
      id: buildChunkId(file.relativePath, 0),
      file: { ...file, title },
      heading: title,
      content: markdown.trim(),
      wordCount: 0,
    });
    return chunks;
  }

  // Handle content before the first ## heading (if any)
  const firstHeadingLine = headingPositions[0];
  if (firstHeadingLine > 0) {
    const introContent = lines.slice(0, firstHeadingLine).join("\n").trim();
    if (introContent.length > 0) {
      const title = frontmatter.title || extractTitle(markdown);
      chunks.push({
        id: buildChunkId(file.relativePath, 0),
        file: { ...file, title },
        heading: title,
        content: introContent,
        wordCount: 0,
      });
    }
  }

  // Split at each ## heading
  for (let i = 0; i < headingPositions.length; i++) {
    const startLine = headingPositions[i];
    const endLine =
      i + 1 < headingPositions.length ? headingPositions[i + 1] : lines.length;

    const headingLine = lines[startLine];
    const headingText = headingLine.replace(/^##\s+/, "").trim();

    // Include sub-headings (###, ####) as part of the content
    const contentLines = lines.slice(startLine + 1, endLine);
    const content = contentLines.join("\n").trim();

    if (content.length > 0 || headingText.length > 0) {
      chunks.push({
        id: buildChunkId(file.relativePath, i + 1),
        file: { ...file, title: frontmatter.title || extractTitle(markdown) },
        heading: headingText,
        content: headingText + "\n\n" + content,
        wordCount: 0,
      });
    }
  }

  return chunks;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function buildChunkId(relativePath: string, index: number): string {
  const safePath = relativePath.replace(/[\/\\]/g, "_").replace(/\.md$/, "");
  return `${safePath}__chunk_${index}`;
}

function extractTitle(markdown: string): string {
  // Try H1 first
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();

  // Try H2
  const h2 = markdown.match(/^##\s+(.+)$/m);
  if (h2) return h2[1].trim();

  // Try first non-empty line
  const firstLine = markdown.split("\n").find((l) => l.trim().length > 0);
  return firstLine?.trim().slice(0, 80) || "Untitled";
}

export function countWords(text: string): number {
  // Strip code blocks to avoid counting code as words
  const noCode = text.replace(/```[\s\S]*?```/g, "");
  return noCode
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .length;
}
