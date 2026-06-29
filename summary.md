# Discovery Support — Implementation Plan

## Overview

Add full Cribl REST Collector discovery support to the wizard form, AI Builder parser, and LLM prompt. Discovery lets Cribl enumerate a list of items (e.g. GitHub repos) before collecting from each one — it is the key feature for paginated multi-resource collection.

## Discovery Types (from openapi.json)

| Type | Purpose |
|---|---|
| `none` | No discovery (current hardcoded default) |
| `http` | Call a URL to discover items; supports its own pagination |
| `json` | Hard-code a JSON result as the discovery list |
| `list` | Comma-separated static list of items |

The `http` type mirrors the collect pagination types: `none`, `response_body`, `response_header`, `response_header_link`, `request_offset`, `request_page`.

## High-Level Tasks

### 1. `WizardContext.tsx` — Extend `CollectorConfig`
Add discovery fields:
- `discoverType: 'none' | 'http' | 'json' | 'list'`
- `discoverUrl`, `discoverMethod`, `discoverRequestHeaders`, `discoverDataField` (http)
- Discovery pagination sub-fields mirroring the existing collect pagination fields
- `manualDiscoverResult` (json), `itemList` (list)

### 2. `CollectorConfigPage.tsx` — Add Discovery UI section
After the existing pagination section, add a collapsible "Discovery" section:
- Type dropdown
- Conditional fields per type
- For `http`: URL input, method select, request headers table, data field, pagination sub-section (same pattern as collect pagination)
- For `json`: textarea for manual JSON result + optional data field
- For `list`: textarea for comma-separated items

### 3. `buildCollectorJson` — Emit full discovery block
Replace the hardcoded `discovery: { discoverType: 'none' }` with a proper block built from `CollectorConfig` discovery fields.

### 4. `ChatPage.tsx` — `parseSavedJob` extraction
Extend the parser to extract all discovery fields from AI-generated JSON so "Load into wizard" preserves them.

### 5. `ChatPage.tsx` — System prompt schema
Add discovery types and examples to the schema block. Update the `discoverType: 'none'` example to show `http` usage for APIs like GitHub repos.

### 6. `App.css` — Discovery section styles
Styles for the new discovery form section (reuse existing pagination field patterns).
