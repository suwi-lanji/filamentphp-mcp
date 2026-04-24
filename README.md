<p align="center">
  <img src="https://img.shields.io/npm/v/filamentphp-mcp?style=for-the-badge&color=6366f1" alt="npm version">
  <img src="https://img.shields.io/npm/dt/filamentphp-mcp?style=for-the-badge&color=22c55e" alt="npm downloads">
  <img src="https://img.shields.io/github/license/suwi-lanji/filamentphp-mcp?style=for-the-badge&color=64748b" alt="license">
  <img src="https://img.shields.io/node/v/filamentphp-mcp?style=for-the-badge&color=339933" alt="node version">
  <img src="https://img.shields.io/github/actions/workflow/status/suwi-lanji/filamentphp-mcp/publish.yml?style=for-the-badge&label=ci" alt="ci status">
</p>

<h1 align="center">FilamentPHP MCP Server</h1>

<p align="center">
  An <strong>MCP (Model Context Protocol)</strong> server that gives AI agents access to <strong>FilamentPHP v5.x documentation</strong>.<br>
  Search, browse, and read FilamentPHP docs, component references, code examples, and configuration guides — directly from your AI coding assistant.
</p>

---

## Features

- **Instant Documentation Access** — AI agents can query FilamentPHP docs without leaving the coding environment
- **Smart Keyword Search** — TF-IDF scoring with heading boost, phrase matching, and camelCase splitting
- **Zero External Dependencies** — Pure in-memory index, no databases or API keys needed
- **79 Docs Indexed** — All FilamentPHP v5.x documentation across 13 sections, 527 searchable chunks
- **One-Command Install** — Works with `npx`, no manual setup required

## Install

### via npx (recommended — no install needed)

```bash
npx filamentphp-mcp
```

### via npm

```bash
npm install -g filamentphp-mcp
filamentphp-mcp
```

### via package.json

```bash
npm install filamentphp-mcp
```

Requires **Node.js >= 18.0.0**.

---

## How It Works

At startup, the server:

1. Loads all 79 FilamentPHP v5.x markdown docs from the bundled `docs/` directory
2. Strips Astro framework components (`<Aside>`, `<Disclosure>`, imports)
3. Splits docs into ~527 searchable chunks at `##` heading boundaries
4. Builds an in-memory TF-IDF index with zero external dependencies

## Tools

| Tool | Description |
|------|-------------|
| `filamentphp_health` | Server status and index statistics |
| `list_docs_sections` | List all documentation sections with file counts |
| `list_docs_in_section` | List files within a specific section |
| `search_filamentphp_docs` | Keyword search with ranked results and snippets |
| `get_filamentphp_doc` | Read the full content of a specific doc file |

---

## MCP Client Configuration

### Claude Desktop

Add to your Claude Desktop config file (`claude_desktop_config.json`):

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

### OpenCode

Add to your OpenCode configuration:

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

Add to your Cursor MCP settings (`.cursor/mcp.json` in your project root):

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

Add to your VS Code MCP settings:

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

### Using a local clone (development)

If you have cloned the repository:

```json
{
  "mcpServers": {
    "filamentphp": {
      "command": "node",
      "args": ["/absolute/path/to/filamentphp-mcp/dist/index.js"]
    }
  }
}
```

### Custom docs directory

If you want to point to a custom FilamentPHP docs directory:

```json
{
  "mcpServers": {
    "filamentphp": {
      "command": "npx",
      "args": ["-y", "filamentphp-mcp"],
      "env": {
        "DOCS_DIR": "/path/to/your/filamentphp/docs"
      }
    }
  }
}
```

---

## Search Features

- **TF-IDF scoring** with cosine normalization
- **Heading boost** (3x) for terms matching chunk headings
- **Exact phrase matching** with proximity scoring (5.0 boost)
- **CamelCase splitting** (`TextInput` → `text-input`, `FileUpload` → `file-upload`)
- **Stop word filtering** (120+ common English words)
- **Snippet extraction** with bold term highlighting

## Index Stats

| Metric | Value |
|--------|-------|
| Markdown files | 79 |
| Documentation sections | 13 |
| Searchable chunks | 527 |
| Words indexed | 57,801 |
| Startup time | ~30ms |

---

## Development

```bash
# Clone the repository
git clone https://github.com/suwi-lanji/filamentphp-mcp.git
cd filamentphp-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode (with hot reload)
npm run dev

# Run the server
npm start

# Run tests (80 tests)
npm test

# Run tests in watch mode
npm run test:watch
```

## Project Structure

```
filamentphp-mcp/
├── src/
│   ├── index.ts          # MCP server entry point (5 tools)
│   ├── types.ts           # TypeScript interfaces
│   ├── docs-loader.ts     # Markdown parser, Astro stripper, chunker
│   └── docs-search.ts     # TF-IDF search engine
├── tests/
│   ├── docs-loader.test.ts   # 31 tests
│   ├── docs-search.test.ts   # 29 tests
│   └── mcp-server.test.ts    # 20 tests
├── filamentphp-repo/docs/    # 79 FilamentPHP v5.x docs
├── .github/workflows/publish.yml  # Auto-publish to npm on tags
├── package.json
└── tsconfig.json
```

## CI/CD

This package uses **GitHub Actions** for automated publishing to npm. When you push a new semantic version tag, the pipeline automatically builds, tests, and publishes:

```bash
# Bump version and create tag
npm version patch   # or minor / major
git push origin main --tags
```

The pipeline runs:
1. Checkout code
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. Build TypeScript (`npm run build`)
5. Run all tests (`npm test`)
6. Publish to npm with provenance (`npm publish --provenance --access public`)

You can also trigger a publish manually from the **Actions** tab on GitHub.

---

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `DOCS_DIR` | Path to a custom FilamentPHP docs directory | `./filamentphp-repo/docs/` |

## Related

- [FilamentPHP](https://filamentphp.com/) — The admin panel framework for Laravel
- [Model Context Protocol](https://modelcontextprotocol.io/) — The open standard for AI tool integration
- [FilamentPHP v5.x Docs Source](https://github.com/filamentphp/filament/tree/5.x/docs) — Raw documentation on GitHub

---

## License

[MIT](LICENSE) &copy; suwi-lanji
