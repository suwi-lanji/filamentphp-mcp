# FilamentPHP MCP Server

An MCP (Model Context Protocol) server that gives AI agents access to **FilamentPHP v5.x documentation**. Enables agents to search, browse, and read FilamentPHP docs, component references, code examples, and configuration guides.

## How It Works

At startup, the server:

1. Loads all 79 FilamentPHP v5.x markdown docs from the `filamentphp-repo/docs/` directory
2. Strips Astro framework components (`<Aside>`, `<Disclosure>`, imports)
3. Splits docs into ~527 searchable chunks at `##` heading boundaries
4. Builds an in-memory TF-IDF index (zero external dependencies)

## Tools

| Tool | Description |
|------|-------------|
| `filamentphp_health` | Server status and index statistics |
| `list_docs_sections` | List all documentation sections with file counts |
| `list_docs_in_section` | List files within a specific section |
| `search_filamentphp_docs` | Keyword search with ranked results and snippets |
| `get_filamentphp_doc` | Read the full content of a specific doc file |

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run
npm start

# Development mode
npm run dev

# Run tests
npm test
```

## Configuration

Set the `DOCS_DIR` environment variable to point to a FilamentPHP docs directory. By default, it looks for `./filamentphp-repo/docs/`.

## MCP Client Configuration

Add to your MCP client config (e.g., Claude Desktop, Cursor):

```json
{
  "mcpServers": {
    "filamentphp": {
      "command": "node",
      "args": ["/path/to/filamentphp-mcp/dist/index.js"],
      "env": {
        "DOCS_DIR": "/path/to/filamentphp-mcp/filamentphp-repo/docs"
      }
    }
  }
}
```

## Search Features

- **TF-IDF scoring** with cosine normalization
- **Heading boost** (3x) for terms matching chunk headings
- **Exact phrase matching** with proximity scoring
- **CamelCase splitting** (`TextInput` → `text-input`, `FileUpload` → `file-upload`)
- **Stop word filtering** (120+ common English words)
- **Snippet extraction** with bold term highlighting

## Index Stats

- **79** markdown files across **13** sections
- **527** searchable chunks
- **57,801** words indexed
- Startup time: ~30ms

## License

MIT
