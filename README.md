# Hong Kong Mahjong (Web)

Single-hand Hong Kong Mahjong playable in the browser: 1 human vs 3 bots. Built with vanilla JS and Vite.

## Features
- Full draw/discard flow with chi/pong/kong/ron
- Simplified fan scoring with configurable minimum and cap
- Bot difficulty (easy/medium/hard)
- Rule profiles loaded from `public/rule_profiles.json` and persisted in localStorage
- Desktop and mobile layouts (landscape preferred)

## Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Assets
Static assets live under `public/assets/` and are referenced at runtime via `/assets/...`.

