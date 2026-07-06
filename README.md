# REST Collecto

REST Collecto is a Cribl App Platform application that helps you create and manage [Cribl REST Collector](https://docs.cribl.io/stream/collectors-rest/) configurations. Point it at an OpenAPI spec or describe your API in natural language, and it generates a complete, ready-to-push Collector configuration — no manual JSON editing required.

---

## What it does

- **Wizard** — Import an OpenAPI spec (JSON or YAML, file or URL), pick an endpoint, and fill in a guided form. The wizard pre-fills fields from the spec: URL, HTTP method, query parameters, headers, and any enum values show up as dropdowns.
- **AI Builder** — Describe the API you want to collect from in plain English. An LLM generates the full collector configuration for you, including authentication, pagination, and discovery.
- **Projects** — Every configuration is saved as a project in Cribl's KV store. Come back later to edit, re-generate, or push updates.
- **Push to Cribl** — Send the finished configuration directly to your Cribl instance. If a collector with the same ID already exists it will be updated (upsert).

---

## Installation

1. Go to the latest [release] (https://github.com/Cribl-Community/CC-rest-collecto/releases/latest).
2. Under Assets, right click on the app .tgz file (the first entry) and copy the url.
3. Log in to Cribl and then click on **Apps->View All**
4. Click **Add App->Import from Url**.
5. Paste the app url you copied to the clipboard.
6. Click **Import**.
   
## Getting started

### First-time setup

1. Open REST Collecto from the Cribl App Platform.
2. Click **+ New Project** to begin.
3. Choose a path:
   - **OpenAPI Spec** — paste or fetch a spec to use the guided wizard.
   - **AI Builder** — describe what you want to collect and let the LLM do the work.

If you plan to use the AI Builder, go to **Settings** first and save your Anthropic API key and preferred model (e.g. `claude-3-5-sonnet-20241022`).

---

## The Wizard

### Step 1 — Spec Input

Paste a raw OpenAPI spec (JSON or YAML) directly into the text area, or provide a URL pointing to one (e.g. `https://petstore3.swagger.io/api/v3/openapi.json`). Large specs are supported.

### Step 2 — Select Endpoint

Browse the parsed list of API operations and pick the one you want to collect from. Operations are grouped by tag and show the HTTP method and path.

### Step 3 — Configure Collector

The form is pre-filled from the spec. Key sections:

| Section | What to configure |
|---|---|
| **Identity** | Collector ID (used as the unique key in Cribl) and optional description |
| **Collection** | URL (JS expression), HTTP method, pagination type and its sub-fields |
| **Discovery** | Enumerate items before collection — HTTP endpoint, static list, or hard-coded JSON |
| **Authentication** | None, Basic, or secret-reference types |
| **Request Headers / Params** | Pre-filled from spec parameters; values are JS expressions |
| **Advanced** | Timeout, TLS verification, routing options |

**URL expressions** use JavaScript syntax. Use single quotes for literals (`'https://api.example.com/data'`), or backtick template literals for dynamic segments (`` `https://api.example.com/users/${__srcId}` ``).

**Secrets** are referenced as `C.Secret("secretName").value` — these resolve to Cribl-managed secrets at runtime. Never hard-code credentials.

### Step 4 — Schedule

Set the cron schedule, timezone, and the time window each run should cover.

### Step 5 — Review & Export

Inspect the generated `SavedJob` JSON, then:
- **Download** — save the file and import it manually in Cribl.
- **Push** — send it directly to Cribl. You can rename the collector ID before pushing if needed.
- **Save Project** — persist the configuration for later editing.

---

## The AI Builder

Type a description of the API and data you want to collect. The AI will ask clarifying questions if needed, then generate a complete `SavedJob` configuration.

Example prompts:
- *"Pull all issues from my GitHub repos using a personal access token"*
- *"Collect Stripe payment intents, paginated by cursor"*
- *"Fetch PagerDuty incidents from the last 4 hours"*

Once the AI generates a config, a **Load into Wizard** button appears below the JSON block. Click it to load the configuration into the wizard for review and editing before pushing.

The conversation is auto-saved to your project after each AI response, so you can close the app and resume later.

---

## Discovery

Discovery lets the collector enumerate a list of items first (e.g. all repos in an org) and then collect data for each item individually.

| Type | Use when |
|---|---|
| **HTTP** | The list of items comes from an API endpoint that you can call |
| **JSON** | You have a hard-coded JSON object containing the list |
| **List** | You have a small, known set of items (comma-separated) |

When discovery is active, each discovered item is available as `__srcId` in the collection URL expression. For example, if discovery returns a list of repo names, the collection URL might be:

```
`https://api.github.com/repos/${__srcId}/issues`
```

---

## Pagination

Both the collection request and the HTTP discovery request support pagination. Select the type that matches your API:

| Type | How it works |
|---|---|
| **Response Body** | The next page token/URL is a field in the response JSON |
| **Response Header** | The next page token/URL is in a response header |
| **Response Header Link** | Standard `Link: <url>; rel="next"` header |
| **Request Offset** | Increment an offset query parameter each page |
| **Request Page** | Increment a page number query parameter each page |

---

## Projects

All work is saved as projects. From the **Projects** home screen you can:

- **Open** — resume where you left off (routes to the most appropriate step automatically).
- **Update Spec** — reload the spec to pick up API changes while preserving your existing configuration.
- **AI Builder** — reopen the AI chat session with full history restored.
- **Rename** — click the project name to rename it inline.
- **Delete** — remove the project and all its saved data.

---

## Pushing to Cribl

From the Review page, select the target **Config Group** (defaults to `default`) and optionally edit the **Collector ID**, then click **Push to Cribl**.

- If no collector with that ID exists, it is created.
- If one already exists, it is updated in place (upsert via `PATCH`).

You can also export the JSON and import it manually via **Manage > Collectors > Import** in the Cribl UI.
