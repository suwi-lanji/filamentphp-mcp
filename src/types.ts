/**
 * Core type definitions for the FilamentPHP docs MCP server.
 */

/** A single documentation section (e.g., "03-resources") */
export interface DocSection {
  /** Section number, e.g. "03-resources" */
  id: string;
  /** Human-readable section name */
  name: string;
  /** All markdown files within this section */
  files: DocFile[];
}

/** A single documentation file on disk */
export interface DocFile {
  /** Absolute path to the .md file */
  absolutePath: string;
  /** Relative path from docs root, e.g. "03-resources/01-overview.md" */
  relativePath: string;
  /** Title extracted from frontmatter or first H1/H2 */
  title: string;
}

/** A searchable chunk of documentation, split at ## headings */
export interface DocChunk {
  /** Unique identifier for this chunk */
  id: string;
  /** The parent file this chunk came from */
  file: DocFile;
  /** The ## heading text (empty for intro/first chunk) */
  heading: string;
  /** The raw markdown content of this section */
  content: string;
  /** Word count of the content */
  wordCount: number;
}

/** A search result returned by the search engine */
export interface SearchResult {
  /** The matched chunk */
  chunk: DocChunk;
  /** Relevance score (higher = more relevant) */
  score: number;
  /** Snippet of text around the matched query terms */
  snippet: string;
  /** Which query terms matched */
  matchedTerms: string[];
}

/** The full in-memory docs index */
export interface DocsIndex {
  /** All sections with their files */
  sections: DocSection[];
  /** All chunks across all files, pre-processed and ready for search */
  chunks: DocChunk[];
  /** Total word count across all docs */
  totalWords: number;
}
