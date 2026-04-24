/**
 * Docs search engine - TF-IDF inspired keyword search over pre-processed doc chunks.
 *
 * For a ~78K word corpus, this runs entirely in memory with no external dependencies.
 * All scores are normalized so the top result always scores 1.0.
 */

import type { DocChunk, DocsIndex, SearchResult } from "./types.js";

// ─── Stop words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "because", "but", "and", "or", "if", "while", "that", "this",
  "these", "those", "it", "its", "i", "me", "my", "we", "our", "you",
  "your", "he", "him", "his", "she", "her", "they", "them", "their",
  "what", "which", "who", "whom", "up", "about", "also", "any",
]);

// ─── Search Engine ────────────────────────────────────────────────────────────

export class DocsSearchEngine {
  private chunks: DocChunk[];
  private chunkTerms: Map<string, string[]> = new Map(); // chunkId -> token array
  private idf: Map<string, number> = new Map(); // term -> IDF score
  private chunkNorms: Map<string, number> = new Map(); // chunkId -> norm for cosine

  constructor(index: DocsIndex) {
    this.chunks = index.chunks;
    this.buildIndex();
  }

  /**
   * Search the docs for the given query string.
   * Returns results sorted by relevance score (highest first).
   *
   * @param query - The search query (e.g., "table columns filter")
   * @param limit - Max number of results (default 10)
   * @returns Ranked search results with snippets and scores
   */
  search(query: string, limit = 10): SearchResult[] {
    if (!query.trim()) return [];

    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) return [];

    const scored = new Map<string, { score: number; matchedTerms: string[] }>();

    for (const chunk of this.chunks) {
      const terms = this.chunkTerms.get(chunk.id);
      if (!terms) continue;

      let score = 0;
      const matchedTerms: string[] = [];

      for (const qTerm of queryTerms) {
        const termScore = this.computeTermScore(qTerm, terms, chunk);
        if (termScore > 0) {
          score += termScore;
          if (!matchedTerms.includes(qTerm)) {
            matchedTerms.push(qTerm);
          }
        }
      }

      // Also try matching multi-word phrases from the original query
      const phraseBoost = this.computePhraseScore(query, chunk.content, chunk.heading);
      score += phraseBoost;

      if (score > 0) {
        scored.set(chunk.id, { score, matchedTerms });
      }
    }

    // Sort by score descending
    const results: SearchResult[] = [];
    const sorted = [...scored.entries()].sort((a, b) => b[1].score - a[1].score);

    const topScore = sorted.length > 0 ? sorted[0][1].score : 1;

    for (let i = 0; i < Math.min(sorted.length, limit); i++) {
      const [chunkId, data] = sorted[i];
      const chunk = this.chunks.find((c) => c.id === chunkId);
      if (!chunk) continue;

      results.push({
        chunk,
        score: Math.round((data.score / topScore) * 100) / 100,
        snippet: this.extractSnippet(chunk.content, queryTerms, 200),
        matchedTerms: data.matchedTerms,
      });
    }

    return results;
  }

  /**
   * Get the total number of indexed chunks.
   */
  get chunkCount(): number {
    return this.chunks.length;
  }

  // ─── Index Building ──────────────────────────────────────────────────────

  private buildIndex(): void {
    const N = this.chunks.length;
    const df: Map<string, number> = new Map(); // document frequency

    // Tokenize each chunk
    for (const chunk of this.chunks) {
      const terms = this.tokenize(chunk.content + " " + chunk.heading);
      this.chunkTerms.set(chunk.id, terms);

      // Count unique terms per chunk for DF
      const uniqueTerms = new Set(terms);
      for (const term of uniqueTerms) {
        df.set(term, (df.get(term) || 0) + 1);
      }
    }

    // Compute IDF: log(N / df) + 1 (smoothed)
    for (const [term, freq] of df.entries()) {
      this.idf.set(term, Math.log(N / freq) + 1);
    }

    // Pre-compute norms for cosine normalization
    for (const chunk of this.chunks) {
      const terms = this.chunkTerms.get(chunk.id) || [];
      const tfMap = this.countFrequencies(terms);
      let normSq = 0;
      for (const [term, tf] of tfMap.entries()) {
        const w = tf * (this.idf.get(term) || 1);
        if (w) normSq += w * w;
      }
      this.chunkNorms.set(chunk.id, Math.sqrt(normSq) || 1);
    }
  }

  private countFrequencies(terms: string[]): Map<string, number> {
    const freq = new Map<string, number>();
    for (const t of terms) {
      freq.set(t, (freq.get(t) || 0) + 1);
    }
    return freq;
  }

  // ─── Scoring ────────────────────────────────────────────────────────────

  private computeTermScore(
    queryTerm: string,
    chunkTerms: string[],
    chunk: DocChunk
  ): number {
    // Boost factor for matching in the heading
    const headingTerms = this.tokenize(chunk.heading.toLowerCase());
    const inHeading = headingTerms.includes(queryTerm);

    // Count occurrences in chunk (TF)
    let tf = 0;
    for (const t of chunkTerms) {
      if (t === queryTerm) tf++;
    }

    if (tf === 0) return 0;

    // Normalized TF (1 + log(tf)) with ceiling to prevent very long chunks from dominating
    const normalizedTf = 1 + Math.log(tf);

    // IDF
    const idf = this.idf.get(queryTerm) || 1;

    // Base TF-IDF score
    let score = normalizedTf * idf;

    // Boost for heading match (3x)
    if (inHeading) {
      score *= 3;
    }

    // Cosine normalization to prevent longer documents from always winning
    const norm = this.chunkNorms.get(chunk.id) || 1;
    score /= norm;

    return score;
  }

  private computePhraseScore(query: string, content: string, heading: string = ""): number {
    const lowerContent = (content + " " + heading).toLowerCase();
    const lowerQuery = query.toLowerCase().trim();

    // Direct phrase match gets a big boost
    if (lowerContent.includes(lowerQuery)) {
      return 5.0;
    }

    // Partial phrase match (query words appearing in close proximity)
    const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 2);
    if (queryWords.length >= 2) {
      let proximityMatches = 0;
      for (let i = 0; i < queryWords.length - 1; i++) {
        // Check if consecutive query words appear within 20 chars of each other
        const pos1 = lowerContent.indexOf(queryWords[i]);
        const pos2 = lowerContent.indexOf(queryWords[i + 1]);
        if (pos1 !== -1 && pos2 !== -1 && Math.abs(pos1 - pos2) < 20) {
          proximityMatches++;
        }
      }
      return proximityMatches * 1.5;
    }

    return 0;
  }

  // ─── Snippet Extraction ─────────────────────────────────────────────────

  private extractSnippet(
    content: string,
    queryTerms: string[],
    maxLen: number
  ): string {
    // Strip code blocks from snippet for readability
    const stripped = content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Find the best position: where the most query terms appear
    const lower = stripped.toLowerCase();
    let bestPos = 0;
    let bestScore = 0;

    // Scan in 50-char windows
    for (let i = 0; i < stripped.length; i += 50) {
      const window = lower.slice(i, i + maxLen);
      let windowScore = 0;
      for (const term of queryTerms) {
        if (window.includes(term)) windowScore++;
      }
      if (windowScore > bestScore) {
        bestScore = windowScore;
        bestPos = i;
      }
    }

    let snippet = stripped.slice(bestPos, bestPos + maxLen);

    // Clean up boundaries
    if (bestPos > 0) {
      const newlineIdx = snippet.indexOf("\n");
      if (newlineIdx > 0 && newlineIdx < 30) {
        snippet = snippet.slice(newlineIdx + 1);
      } else {
        snippet = "..." + snippet;
      }
    }

    if (bestPos + maxLen < stripped.length) {
      snippet = snippet.slice(0, snippet.lastIndexOf("\n")) + "...";
    }

    // Highlight matched terms with **bold**
    for (const term of queryTerms) {
      const regex = new RegExp(`\\b(${escapeRegex(term)})\\b`, "gi");
      snippet = snippet.replace(regex, "**$1**");
    }

    return snippet.trim();
  }

  // ─── Tokenization ───────────────────────────────────────────────────────

  private tokenize(text: string): string[] {
    const lower = text.toLowerCase();

    // Split on non-alphanumeric characters, keeping hyphens within words
    // E.g., "TextInput" -> ["textinput"], "file-upload" -> ["file-upload"]
    // Also split camelCase and PascalCase into sub-words
    const words = lower
      .replace(/([a-z])([A-Z])/g, "$1-$2") // camelCase -> camel-Case
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2") // ABCDef -> ABC-Def
      .split(/[^a-z0-9\-]+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

    return words;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
