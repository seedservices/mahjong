# Technical Specification — Hong Kong Mahjong Single-Hand (vs Bots)

## Overview
Desktop Mahjong game implemented in Python using Kivy. Runs as a local GUI application with no network dependencies. All logic and UI are in `app.py`, with static assets under `assets/`.

## Technology Stack
- Language: Python 3
- UI Framework: Kivy
- Audio: Kivy SoundLoader + generated WAV files
- Assets: PNG tiles and UI images in `assets/`

## Runtime Environment
- Windows / macOS / Linux (Kivy-supported platforms)
- No external services

## Repository Layout (Relevant)
- `app.py`: Main application and game logic.
- `assets/tiles/`: Tile images and back image.
- `assets/sfx/`: Generated sound effects.
- `assets/fonts/`: Optional CJK fonts.
- `rule_profiles.json`: House rule profiles.
- `requirements.txt`: Python dependencies.

## Core Data Structures
- Tile representation: string codes (e.g., `D1`, `B9`, `E`, `R`, `F1`).
- `Player` dataclass:
  - `hand`: list of tile codes.
  - `melds`: list of text labels for exposed melds.
  - `exposed_melds`: list of tile lists (for scoring).
  - `bonus_tiles`: list of flowers/seasons.
- Game state:
  - Wall tiles list.
  - Discard pile and last discard marker.
  - Current player index.
  - Pending claim structure for human player.
  - Scores (fan-based for the single round).
  - House rules and bot difficulty.

## Tile System
- Suits: dots (D), bamboo (B), characters (C).
- Honors: winds (E, S, W, N) and dragons (R, G, H).
- Bonuses: flowers (F1–F4) and seasons (T1–T4).
- Tiles are loaded into the wall using standard counts (4 copies for base tiles; one each for bonuses).

## Win Detection
Supported win forms:
- Standard: 4 melds + 1 pair.
- Seven pairs.
- Thirteen orphans.
Implementation notes:
- Uses cached recursive checks (`can_form_melds`, `can_form_n_melds`) to validate standard hands.
- For open melds, reduces required meld count to validate the remaining hand.

## Scoring (Simplified Fan)
Scoring is computed in `score_hand_patterns` using:
- Base win (1 fan).
- Self-draw bonus (configurable).
- Concealed hand bonus (configurable).
- All pungs (3 fan).
- Chow count bonus (+1 per chow).
- Suit-based bonuses: all honors, pure one suit, mixed one suit.
- Seven pairs (4 fan).
- Thirteen orphans (13 fan).
- Flowers and seasons (1 fan each).
Fan total is capped to house rules and must meet minimum fan to win.

## House Rules
Profiles load from `rule_profiles.json`. Only the following fields are currently used:
- `min_fan`
- `cap`
- `self_draw`
- `concealed`

Unknown fields are ignored. If file load fails, defaults are used.

## Bot AI
Three difficulty levels:
- Beginner: simplified discard and reduced claim rate.
- Intermediate: heuristic discard evaluation.
- Advanced: discard evaluation considers potential waits and claim outcomes.
Bots can claim win, pong, kong, and chi subject to difficulty-based logic.

## UI Architecture
Kivy widgets build the table layout:
- Player areas for hand counts and exposed melds.
- Central discard area with last discard highlight.
- Control bar for new round, rule editor, and difficulty selector.
- Action area for claims and win declaration.

UI updates are driven by:
- Draw/discard flow.
- Claim resolution.
- End-of-round summary overlay.

## Audio
Sound effects are generated at runtime if missing, stored under `assets/sfx/`.
Events:
- Win
- Pong
- Kong

## Persistence
- Rule profiles are read/written from `rule_profiles.json`.
- No other persistent state.

## Error Handling
Key safeguards:
- Rule profile read/write failures fall back to default rules.
- UI actions are gated by turn state and pending claims.
- Bot scheduled actions are guarded against stale timers.

## Performance
Game logic runs on the main thread. Recursive win checks are cached for speed. UI updates are lightweight and per action.

## Security / Privacy
No network access. All data stays on the local machine.

## Known Gaps / Future Work
- Full Hong Kong scoring catalog.
- Match-style scoring across multiple rounds.
- Save/load game state.
- Enhanced AI and analysis tools.

