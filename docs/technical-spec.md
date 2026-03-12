# Technical Specification — Hong Kong Mahjong Web

## Overview
Browser-based single-hand Hong Kong Mahjong implemented in vanilla JavaScript. The app runs fully client-side with no backend dependencies. Vite is used for local development and production builds.

## Technology Stack
- Language: JavaScript (ES2020+)
- UI: HTML + CSS (no framework)
- Bundler/Dev Server: Vite
- Persistence: localStorage

## Runtime Environment
- Modern desktop browsers (Chrome/Edge/Safari/Firefox)
- Mobile browsers supported (landscape preferred)
- No network services required

## Repository Layout (Relevant)
- `index.html`: Main UI layout.
- `styles.css`: App styling and layout.
- `src/main.js`: Game logic, rendering, and UI wiring.
- `public/assets/`: Tile images, sounds, fonts.
- `public/rule_profiles.json`: Default rule profiles.

## Core Data Structures
- Tile representation: string codes (e.g., `D1`, `B9`, `E`, `R`, `F1`).
- Player object:
  - `hand`: list of tile codes.
  - `melds`: list of display labels.
  - `exposedMelds`: list of tile lists (for scoring).
  - `bonusTiles`: flowers and seasons.
- Game state:
  - Wall tiles list.
  - Discard history with last discard marker.
  - Current player index and pending claim state.
  - House rules and bot difficulty.

## Win Detection
Supported win forms:
- Standard: 4 melds + 1 pair.
- Seven pairs.
- Thirteen orphans.
Open melds reduce the required meld count.

## Scoring (Simplified Fan)
Computed in `scoreHandPatterns`:
- Base win (1 fan).
- Self-draw bonus (configurable).
- Concealed hand bonus (configurable).
- All pungs (3 fan).
- Chow count bonus (+1 per chow).
- Suit bonuses: all honors, pure one suit, mixed one suit.
- Seven pairs, thirteen orphans.
- Flowers and seasons (1 fan each).
Fan total is capped and must meet the minimum fan to win.

## House Rules
Profiles load from `public/rule_profiles.json` and are persisted in localStorage.
Only the following fields are used:
- `min_fan`
- `cap`
- `self_draw`
- `concealed`

## Bot AI
Three difficulty levels:
- Easy: simplified discard and reduced claim rate.
- Medium: heuristic discard evaluation.
- Hard: discard evaluation considers wait potential.

## UI Architecture
- Table layout with four player positions and discard area.
- Central wall visualization and discard grid.
- Action bar for claims and self-draw win.
- Config panel for difficulty and rules.
- Sidebar for scores and log output.

## Persistence
- Rule profiles stored in localStorage.
- No other persistent state.

## Performance
Client-side only. Recursive win checks are memoized for speed. UI updates are DOM-based and optimized for incremental rendering.

