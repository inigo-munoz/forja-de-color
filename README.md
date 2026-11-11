# Forja de Color

Personal PWA for painting miniatures fast: from a photo it builds a zone-by-zone recipe
(Slapchop with diluted paints by default, BSL base/shadow/light on details) using only the
paints you own. The AI step runs through your own Claude / ChatGPT apps by share-and-paste,
so the app never calls any API and stores everything locally (IndexedDB + JSON backups).

- `npm run dev` — local development
- `npm test` — Vitest suite
- `npm run build` — production build (PWA)

Deployed to GitHub Pages from `main` by `.github/workflows/deploy.yml`.
