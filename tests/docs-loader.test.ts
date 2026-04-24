/**
 * Tests for docs-loader.ts
 * Covers: frontmatter extraction, Astro stripping, chunking, file scanning, full load
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  extractFrontmatter,
  stripAstroComponents,
  splitIntoChunks,
  countWords,
  loadDocs,
  getDocByPath,
} from "../src/docs-loader.js";
import type { DocFile } from "../src/types.js";

// ─── extractFrontmatter ──────────────────────────────────────────────────────

describe("extractFrontmatter", () => {
  it("should extract title from YAML frontmatter", () => {
    const raw = `---
title: What is Filament?
contents: false
---

# Some content here`;
    const { frontmatter, content } = extractFrontmatter(raw);
    expect(frontmatter.title).toBe("What is Filament?");
    expect(frontmatter.contents).toBe(false);
    expect(content.trim()).toBe("# Some content here");
  });

  it("should handle quoted string values", () => {
    const raw = `---
title: "Getting Started with Filament"
---

Content`;
    const { frontmatter } = extractFrontmatter(raw);
    expect(frontmatter.title).toBe("Getting Started with Filament");
  });

  it("should handle single-quoted string values", () => {
    const raw = `---
title: 'Panel Configuration'
---

Content`;
    const { frontmatter } = extractFrontmatter(raw);
    expect(frontmatter.title).toBe("Panel Configuration");
  });

  it("should return empty frontmatter and full content when no frontmatter exists", () => {
    const raw = `# No frontmatter here

Some content`;
    const { frontmatter, content } = extractFrontmatter(raw);
    expect(Object.keys(frontmatter).length).toBe(0);
    expect(content).toBe(raw);
  });

  it("should handle boolean values correctly", () => {
    const raw = `---
title: Test
published: true
draft: false
---

Content`;
    const { frontmatter } = extractFrontmatter(raw);
    expect(frontmatter.published).toBe(true);
    expect(frontmatter.draft).toBe(false);
  });

  it("should handle frontmatter with various data types", () => {
    const raw = `---
title: Overview
order: 1
contents: false
description: This is a description
---

# Overview`;
    const { frontmatter, content } = extractFrontmatter(raw);
    expect(frontmatter.title).toBe("Overview");
    expect(frontmatter.order).toBe("1");
    expect(frontmatter.contents).toBe(false);
    expect(frontmatter.description).toBe("This is a description");
    expect(content.trim()).toBe("# Overview");
  });
});

// ─── stripAstroComponents ────────────────────────────────────────────────────

describe("stripAstroComponents", () => {
  it("should remove Astro import statements", () => {
    const md = `import Aside from "@components/Aside.astro"
import Disclosure from "@components/Disclosure.astro"

# Hello

Some content`;
    const result = stripAstroComponents(md);
    expect(result).not.toContain("import");
    expect(result).not.toContain("Aside.astro");
    expect(result).toContain("# Hello");
    expect(result).toContain("Some content");
  });

  it("should convert <Aside variant='warning'> to blockquote with WARNING tag", () => {
    const md = `<Aside variant="warning">
    Make sure filament/forms is installed.
</Aside>`;
    const result = stripAstroComponents(md);
    expect(result).toContain("WARNING");
    expect(result).toContain("Make sure filament/forms is installed.");
    expect(result).toContain(">");
  });

  it("should convert <Aside variant='tip'> to blockquote with TIP tag", () => {
    const md = `<Aside variant="tip">
    You can customize this behavior.
</Aside>`;
    const result = stripAstroComponents(md);
    expect(result).toContain("TIP");
    expect(result).toContain("You can customize this behavior.");
  });

  it("should convert <Aside variant='info'> to blockquote with INFO tag", () => {
    const md = `<Aside variant="info">
    This is additional context.
</Aside>`;
    const result = stripAstroComponents(md);
    expect(result).toContain("INFO");
  });

  it("should convert <Disclosure> blocks with summary", () => {
    const md = `<Disclosure>
    <span slot="summary">What is Server-Driven UI?</span>

    SDUI is an architecture used by companies like Meta, Airbnb.
</Disclosure>`;
    const result = stripAstroComponents(md);
    expect(result).not.toContain("<Disclosure");
    expect(result).not.toContain("</Disclosure>");
    expect(result).toContain("**What is Server-Driven UI?**");
    expect(result).toContain("SDUI is an architecture");
  });

  it("should handle mixed Astro and markdown content", () => {
    const md = `import Aside from "@components/Aside.astro"

## Getting Started

<Aside variant="info">
    Before proceeding, ensure Filament is installed.
</Aside>

Install the package:

\`\`\`bash
composer require filament/filament
\`\`\``;

    const result = stripAstroComponents(md);
    expect(result).not.toContain("import");
    expect(result).toContain("## Getting Started");
    expect(result).toContain("INFO");
    expect(result).toContain("composer require filament/filament");
  });

  it("should collapse excessive blank lines", () => {
    const md = `# Title


Some text



More text`;
    const result = stripAstroComponents(md);
    // Should not have more than 2 consecutive newlines
    expect(result).not.toMatch(/\n{3,}/);
  });
});

// ─── splitIntoChunks ─────────────────────────────────────────────────────────

describe("splitIntoChunks", () => {
  const dummyFile: DocFile = {
    absolutePath: "/test/03-resources/01-overview.md",
    relativePath: "03-resources/01-overview.md",
    title: "",
  };

  it("should split a markdown file on ## headings", () => {
    const md = `# Overview

Some intro content.

## Creating Records

Content about creating records.

## Editing Records

Content about editing records.

## Deleting Records

Content about deleting records.`;

    const chunks = splitIntoChunks(md, dummyFile, { title: "Resources Overview" });
    expect(chunks.length).toBe(4); // 1 intro + 3 sections
    expect(chunks[0].heading).toBe("Resources Overview");
    expect(chunks[1].heading).toBe("Creating Records");
    expect(chunks[2].heading).toBe("Editing Records");
    expect(chunks[3].heading).toBe("Deleting Records");
  });

  it("should include sub-headings (###, ####) in chunk content", () => {
    const md = `## Forms

### Text Input

Text input content.

### Select

Select content.

#### Custom Options

Custom options content.`;

    const chunks = splitIntoChunks(md, dummyFile);
    expect(chunks.length).toBe(1);
    expect(chunks[0].heading).toBe("Forms");
    expect(chunks[0].content).toContain("### Text Input");
    expect(chunks[0].content).toContain("#### Custom Options");
  });

  it("should create a single chunk when no ## headings exist", () => {
    const md = `# Single Section

All content in one block with no H2 headings.`;
    const chunks = splitIntoChunks(md, dummyFile);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain("Single Section");
  });

  it("should handle empty content between headings gracefully", () => {
    const md = `## First

Content here.

## Second

## Third

More content.`;

    const chunks = splitIntoChunks(md, dummyFile);
    // "Second" has no content but still gets a chunk because heading exists
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("should generate unique IDs for each chunk", () => {
    const md = `## Section A

Content A.

## Section B

Content B.

## Section C

Content C.`;

    const chunks = splitIntoChunks(md, dummyFile);
    const ids = chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // All unique
  });

  it("should produce chunk IDs that are deterministic", () => {
    const md = `## Alpha

Content.

## Beta

Content.`;

    const chunks1 = splitIntoChunks(md, dummyFile);
    const chunks2 = splitIntoChunks(md, dummyFile);
    expect(chunks1.map((c) => c.id)).toEqual(chunks2.map((c) => c.id));
  });
});

// ─── countWords ───────────────────────────────────────────────────────────────

describe("countWords", () => {
  it("should count words in plain text", () => {
    expect(countWords("hello world foo bar")).toBe(4);
  });

  it("should exclude code blocks from word count", () => {
    const text = `Some text here.

\`\`\`php
echo "hello world this is code";
echo "more code here";
\`\`\`

More text at the end.`;

    const count = countWords(text);
    expect(count).toBeLessThan(20);
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it("should return 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("should handle multiple spaces and newlines", () => {
    expect(countWords("  hello   \n\n  world  ")).toBe(2);
  });
});

// ─── loadDocs (integration with real docs) ────────────────────────────────────

describe("loadDocs", () => {
  const docsDir = path.resolve(__dirname, "..", "filamentphp-repo", "docs");

  it("should load all sections from the actual FilamentPHP docs", () => {
    const index = loadDocs(docsDir);

    expect(index.sections.length).toBeGreaterThanOrEqual(10);
    expect(index.chunks.length).toBeGreaterThanOrEqual(100);
    expect(index.totalWords).toBeGreaterThan(50000);
  });

  it("should populate file titles in sections", () => {
    const index = loadDocs(docsDir);

    const filesWithTitle = index.sections
      .flatMap((s) => s.files)
      .filter((f) => f.title && f.title.length > 0);
    expect(filesWithTitle.length).toBeGreaterThan(0);
  });

  it("should throw an error for non-existent directory", () => {
    expect(() => loadDocs("/non/existent/path")).toThrow("Docs directory not found");
  });

  it("should not include the empty _PACKAGES section", () => {
    const index = loadDocs(docsDir);
    const hasPackages = index.sections.some(
      (s) => s.id.includes("PACKAGES")
    );
    expect(hasPackages).toBe(false);
  });
});

// ─── getDocByPath ─────────────────────────────────────────────────────────────

describe("getDocByPath", () => {
  const docsDir = path.resolve(__dirname, "..", "filamentphp-repo", "docs");

  it("should load a specific doc file and return title and content", () => {
    const doc = getDocByPath(docsDir, "01-introduction/01-overview.md");

    expect(doc).not.toBeNull();
    expect(doc!.title).toBeTruthy();
    expect(doc!.content.length).toBeGreaterThan(100);
  });

  it("should return null for non-existent file", () => {
    const doc = getDocByPath(docsDir, "non-existent-file.md");
    expect(doc).toBeNull();
  });

  it("should strip Astro components from the returned content", () => {
    const doc = getDocByPath(docsDir, "01-introduction/01-overview.md");
    expect(doc!.content).not.toContain("@components/");
  });

  it("should load form docs which are code-heavy", () => {
    const doc = getDocByPath(docsDir, "12-components/02-form.md");
    expect(doc).not.toBeNull();
    expect(doc!.content).toContain("```");
    expect(doc!.content.length).toBeGreaterThan(1000);
  });
});
