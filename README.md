<p align="center">
  <img src="https://img.shields.io/npm/v/filamentphp-mcp?style=for-the-badge&color=6366f1" alt="npm version">
  <img src="https://img.shields.io/npm/dt/filamentphp-mcp?style=for-the-badge&color=22c55e" alt="npm downloads">
  <img src="https://img.shields.io/github/license/suwi-lanji/filamentphp-mcp?style=for-the-badge&color=64748b" alt="license">
  <img src="https://img.shields.io/node/v/filamentphp-mcp?style=for-the-badge&color=339933" alt="node version">
  <img src="https://img.shields.io/github/actions/workflow/status/suwi-lanji/filamentphp-mcp/publish.yml?style=for-the-badge&label=ci" alt="ci status">
</p>

<h1 align="center">FilamentPHP MCP Server</h1>

<p align="center">
  <img src="[https://img.shields.io/npm/v/filamentphp-mcp?style=for-the-badge&color=6366f1](https://img.shields.io/npm/v/filamentphp-mcp?style=for-the-badge&color=6366f1)" alt="npm version">
  <img src="[https://img.shields.io/npm/dt/filamentphp-mcp?style=for-the-badge&color=22c55e](https://img.shields.io/npm/dt/filamentphp-mcp?style=for-the-badge&color=22c55e)" alt="npm downloads">
  <img src="[https://img.shields.io/github/license/suwi-lanji/filamentphp-mcp?style=for-the-badge&color=64748b](https://img.shields.io/github/license/suwi-lanji/filamentphp-mcp?style=for-the-badge&color=64748b)" alt="license">
  <img src="[https://img.shields.io/node/v/filamentphp-mcp?style=for-the-badge&color=339933](https://img.shields.io/node/v/filamentphp-mcp?style=for-the-badge&color=339933)" alt="node version">
  <img src="[https://img.shields.io/github/actions/workflow/status/suwi-lanji/filamentphp-mcp/publish.yml?style=for-the-badge&label=ci](https://img.shields.io/github/actions/workflow/status/suwi-lanji/filamentphp-mcp/publish.yml?style=for-the-badge&label=ci)" alt="ci status">
</p>

<h1 align="center">FilamentPHP MCP Server</h1>

<p align="center">
  Connect your AI assistant directly to <strong>FilamentPHP v5.x documentation</strong> using the <strong>Model Context Protocol (MCP)</strong>.<br>
  Search, browse, and read through component references and code examples without leaving your IDE.
</p>

---

## What’s Inside

* **Instant Context:** Your AI agent can pull FilamentPHP docs in real-time while you code.
* **Smart Search:** Uses TF-IDF scoring with heading boosts and camelCase awareness to find exactly what you need.
* **Lightweight:** Fully in-memory index. No databases, no API keys, and no extra fluff.
* **Comprehensive:** Pre-indexed with 79 docs across 13 sections, broken down into 527 searchable chunks.
* **Zero Effort:** Spin it up with a single `npx` command.

## Installation

### Using npx (Recommended)
This is the fastest way to get started. No local installation required:

```bash
npx filamentphp-mcp
```

### Global Install
If you prefer having it available locally:

```bash
npm install -g filamentphp-mcp
filamentphp-mcp
```

### Local Project
Add it to your current project:

```bash
npm install filamentphp-mcp
```

*Note: Requires **Node.js 18.0.0** or higher.*

---

## How it Works

When the server starts up, it handles the heavy lifting for you:

1.  **Loading:** It pulls 79 bundled FilamentPHP v5.x markdown files.
2.  **Cleaning:** It strips out Astro-specific components like `<Aside>` or `<Disclosure>` so the AI sees clean text.
3.  **Chunking:** It breaks the docs into roughly 527 digestible pieces based on `##` headings.
4.  **Indexing:** It builds a lightning-fast search index right in your RAM.

## Tools Available

| Tool | Purpose |
|------|-------------|
| `filamentphp_health` | Check if the server is running and see index stats. |
| `list_docs_sections` | See all available documentation categories. |
| `list_docs_in_section` | Browse specific files within a category. |
| `search_filamentphp_docs` | Find specific topics with ranked results and snippets. |
| `get_filamentphp_doc` | Fetch the full text of a specific document. |

---

## Setup for AI Clients

### Claude Desktop
Open your configuration file:
* **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "filamentphp": {
      "command": "npx",
      "args": ["-y", "filamentphp-mcp"]
    }
  }
}
```

### Cursor
Go to your Cursor MCP settings or create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "filamentphp": {
      "command": "npx",
      "args": ["-y", "filamentphp-mcp"]
    }
  }
}
```

### VS Code (with MCP extension)
Add this to your MCP settings:

```json
{
  "servers": {
    "filamentphp": {
      "command": "npx",
      "args": ["-y", "filamentphp-mcp"]
    }
  }
}
```

---

## Search & Performance

* **Ranked Results:** Uses cosine normalization for accurate relevance.
* **Heading Weight:** Terms found in headings are weighted 3x higher.
* **Developer Friendly:** Handles `TextInput` as `text-input` automatically.
* **Fast:** Startup takes about 30ms, indexing over 57,000 words instantly.

## Development

Want to contribute or run it locally?

```bash
# Clone and enter
git clone https://github.com/suwi-lanji/filamentphp-mcp.git
cd filamentphp-mcp

# Install and build
npm install
npm run build

# Run with hot-reload
npm run dev
```

## Project Layout

* `src/index.ts`: The main entry point and tool definitions.
* `src/docs-loader.ts`: Handles parsing and "Astro-stripping."
* `src/docs-search.ts`: The core TF-IDF search logic.
* `filamentphp-repo/docs/`: The source markdown files.

## Configuration

| Env Variable | Description | Default |
|---------------------|-------------|---------|
| `DOCS_DIR` | Point to your own local version of Filament docs. | `./filamentphp-repo/docs/` |

---
