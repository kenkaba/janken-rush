# JANKEN RUSH maintenance guide

This repository is the production source for JANKEN RUSH.

## Production path

- Repository: `kenkaba/janken-rush`
- Production branch: `main`
- Hosting: GitHub Pages from the repository root
- Live URL: `https://kenkaba.github.io/janken-rush/`
- The game is dependency-free static HTML/CSS/JavaScript.

## Before changing the game

1. Read `README.md` and inspect the current build in `src/game.js`.
2. Preserve portrait mobile play, especially 390 px wide iPhones and safe-area insets.
3. Keep the core rule understandable: read the glowing hand and pick the hand that beats it.
4. Keep win/loss logic inside `src/core.js`; presentation belongs in `src/view.js` and `src/goro.js`.
5. Do not add a framework or runtime dependency unless the requested feature requires it.

## Required verification

Run:

```bash
npm test
```

For interaction or visual changes, also run the local server and play one tutorial fight and one normal fight through the result screen.

```bash
npm run serve
```

The debug panel is available at `/?debug=1`.

## Release rules

- Update the `jr-build` meta value in `index.html` for every production release.
- For user-facing changes, bump the shared `?v=` value in `index.html` and `BUILD.version` in `src/game.js` together.
- Keep the current version values aligned; `npm test` enforces this.
- Push only after `npm test` passes.
- After push, verify the live URL returns the new `jr-build` value.

