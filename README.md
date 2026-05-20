# kiwix-mcp

MCP server exposing the home Kiwix library — Wikipedia, Project Gutenberg, Wiktionary, Wikibooks, Wikiquote, Wikisource — as tools for LLM agents. Designed to be the offline-reference layer for an air-gapped family AI: kids ask questions, the model uses these tools instead of the public internet.

## Tools

| Tool | What it does |
|---|---|
| `kiwix_list_zims` | Discover available libraries + their short names |
| `kiwix_search` | Full-text search across all ZIMs or scoped to one |
| `kiwix_search_books` | Convenience wrapper: search Project Gutenberg only |
| `kiwix_get_article` | Fetch an article as clean markdown (HTML stripped) |
| `kiwix_suggest` | Autocomplete-style title suggestions |

## Environment

```
MCP_TRANSPORT   stdio | http     (default: stdio)
MCP_PORT        3000             (only used in http mode)
MCP_API_KEY     <bearer>         (required in http mode)
KIWIX_BASE_URL                   (default: https://kiwix.lab.mtgibbs.dev)
```

## Local dev

```bash
npm install
MCP_TRANSPORT=stdio npm run dev
```

## Deploy

Manifests live in [`mtgibbs/pi-cluster`](https://github.com/mtgibbs/pi-cluster) under `clusters/pi-k3s/kiwix-mcp/`. CI here builds + pushes multi-arch images to ghcr.io; Flux image automation in the cluster picks them up.
