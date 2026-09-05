# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
# AskMyDocs — Frontend
 
A React + Tailwind + Framer Motion UI for your Day 5 backend. Upload a PDF
on the left ("The Document"), ask questions on the right ("The
Conversation") — answers are grounded in retrieved chunks, with expandable
source citations (page number + relevance score) under each response.
 
## 1. Enable CORS on your backend (required, one-time)
 
Your Express server and this frontend run on different ports
(`localhost:3000` vs `localhost:5173`), so the browser will block requests
between them unless the backend explicitly allows it.
 
In your **backend** folder:
```bash
npm install cors
```
 
In your backend's `server.js`, add near the top (after your other imports):
```js
import cors from "cors";
```
 
Then right after `const app = express();`, add:
```js
app.use(cors());
```
 
Restart your backend server after this change.
 
## 2. Set up the frontend
 
```bash
npm install
cp .env.example .env
npm run dev
```
 
Open the URL Vite prints (usually `http://localhost:5173`).
 
## 3. Use it
 
1. Confirm the top-right dot says "backend connected" (pings your
   Express server's `GET /` route every 15s — if it says "offline",
   your backend probably isn't running or CORS isn't enabled yet)
2. Drop a PDF into the left panel — you'll see a scan-line animation while
   it uploads, loads, splits, and embeds (all four Day 3-5 steps happening
   at once behind that one animation)
3. Once it shows the filename + page/chunk count, ask a question in the
   chat on the right
4. Each answer includes citation chips — click one to expand the actual
   source text it was pulled from
If no document is uploaded, the chat still works as a plain assistant
(same as your Day 2 `/chat` endpoint) — useful for confirming the backend
connection works before testing retrieval.
 
## How the RAG flow works right now (bridge to Day 6)
 
This frontend currently does client-side what Day 6 will move server-side:
 
```js
// in src/App.jsx, handleAsk()
const { results } = await searchDocument(question, 4);   // POST /search
const grounded = buildGroundedPrompt(question, results);  // stuff chunks into the prompt
const answer = await askChat(grounded);                   // POST /chat
```
 
`buildGroundedPrompt()` constructs the same "answer only from this
context" prompt shape that Day 6's backend chain will build instead. Once
you build that chain, you can simplify this frontend down to a single
`POST /ask` call — the UI itself won't need to change, since it's already
built around receiving `{ answer, sources }`.
 
## Design notes
 
- **Palette**: deep pine-ink background, parchment text, lamp-gold for
  actions, muted teal for retrieval/citation elements — meant to feel like
  an archive desk rather than a generic dark-mode SaaS panel.
- **Type**: Fraunces (display serif) for headings, IBM Plex Sans for UI
  text, IBM Plex Mono for citation labels (page numbers, scores) — mono is
  used only where it's real technical data, not as decoration.
- **Motion**: one deliberate animated moment (the scan-line during
  upload); everything else — message entrances, citation expand/collapse —
  responds directly to something you did, not automatic on-load effects.
- Respects `prefers-reduced-motion`.
## Project structure
 
```
src/
  App.jsx       — everything: upload panel, chat panel, API calls
  main.jsx      — React entry point
  index.css     — Tailwind directives + base styles
tailwind.config.js — color/font tokens
```
 
Kept as a single `App.jsx` rather than split into many component files —
easier to read top-to-bottom while you're still connecting frontend
concepts to the backend you just built.