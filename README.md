# Rapkrazy

Write rap lyrics over a beat, and a robot raps them back. Solo writing tool plus a Gartic
Phone-style party mode.

- Design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Setup

Use Node 22.22.2+ (current 22 LTS) or 24.15+. `.nvmrc` is included, so with nvm run `nvm install` then `nvm use`.
Older Node 22.x (22.18+) still works but `npm install` prints "Unsupported engine" warnings (from `npm-run-all2`). Node 20 and older are not supported: `vue-router` 5 needs 22.18+.

```sh
npm install
npm run dev      # http://localhost:5173 (beat clock demo at /dev/clock)
npm run check    # type-check + lint, run before opening a PR
npm run build    # production build
```

Recommended editor: VS Code with the [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) extension.
