# CV Generator

Generate personalised CVs with AI based on your biography and a job description.

## Setup

```bash
pnpm install
cp .env.example .env.local
# Add your GEMINI_API_KEY from https://aistudio.google.com/apikey
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Stateless** — all data stays in the browser, nothing saved to a database
- **LLM for writing, rules for formatting** — dates, locations, and layout use deterministic logic
- **Schema validation** — every AI JSON response is validated against strict schemas
- **Biography conversion** — upload any JSON; AI produces a declarative key-mapping, client transforms safely
- **Relevance analysis** — AI ranks every biography item 1–5 with adjustable sliders
- **Real-time CV preview** — updates as you adjust sliders; regenerate for AI-written content
- **Debug panel** — inspect all AI requests and responses

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Ajv (JSON Schema validation)
- Google AI Studio / Gemini 3.1 Flash Lite (server-side)
