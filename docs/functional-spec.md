# Functional Specification — Hong Kong Mahjong Single-Hand (vs Bots)

## Scope
Single-hand Hong Kong Mahjong desktop game with 1 human player versus 3 bots. Focus is on turn flow, calling (chi/pong/kong), basic scoring and win validation, and a playable visual table.

## Goals
- Provide a complete single-hand experience with draws, discards, and calls.
- Allow human player decisions at each actionable point.
- Ensure win conditions are validated and scored against house rules.
- Offer selectable bot difficulty and editable house rules.

## Non-Goals
- Multi-hand match / session scoring across multiple rounds.
- Full Hong Kong scoring catalog (only a subset of patterns).
- Online multiplayer.
- AI strength beyond simple heuristics.

## Users
- End user: casual player who wants a playable single-hand Hong Kong Mahjong game on desktop.
- Optional: advanced user who wants to adjust house rules (min fan, cap, bonuses).

## Functional Requirements
### Gameplay Flow
- The system initializes a wall with standard tiles (characters, bamboo, dots, winds, dragons) and bonus tiles (flowers/seasons).
- The round starts with each player receiving an initial hand and the wall is shuffled.
- Turns proceed in order: draw a tile, evaluate immediate win, then discard a tile.
- After a discard, other players may claim for win (ron), kong, pong, or chi following priority.
- If a claim is made, the claiming player takes the tile, forms a meld, and continues turn.
- The round ends on a valid win (self-draw or ron) or when a win is declared via the UI.

### Player Actions
- Human can discard by clicking a tile from hand.
- Human can declare win (self-draw) when eligible.
- Human can respond to discard with chi/pong/kong/ron choices presented by the UI.
- Human can start a new round at any time.

### Bot Behavior
- Bots must automatically draw, evaluate win, and discard.
- Bots can claim discard for win or melds based on difficulty settings.
- Difficulty levels:
  - Beginner: reduced claim frequency and simpler discard logic.
  - Intermediate: baseline discard heuristic.
  - Advanced: improved discard selection and limited claim evaluation.

### Win Validation
- A win is valid if it satisfies one of:
  - Standard 4 melds + 1 pair.
  - Seven pairs.
  - Thirteen orphans.
- Open melds reduce required meld count for standard wins.
- Win is subject to minimum fan requirement.

### Scoring (Simplified Fan)
The scoring system computes fan with a limited pattern set:
- Basic win (1 fan).
- Self-draw bonus (optional by rules).
- Concealed hand bonus (optional by rules).
- All pungs (3 fan).
- Chow count bonus (+1 per chow).
- Pure / mixed suit and all honors.
- Seven pairs, thirteen orphans.
- Flowers and seasons (1 fan each).
- Fan cap enforced by house rules.

### House Rules
- Editable rule profile:
  - Minimum fan.
  - Fan cap.
  - Self-draw bonus on/off.
  - Concealed bonus on/off.
- Rule profiles load from and save to `rule_profiles.json`.

### UI Requirements
- Table layout with four player positions and discard area.
- Highlight of the most recent discard.
- Display of exposed melds for each player.
- Display of player hand counts and bonus tiles.
- Action area showing available claims and win declaration.
- Rules panel and difficulty selector accessible during play.

### Audio
- Play sound effects for win, pong, and kong events.

## Data & State
The game maintains:
- Wall tiles (shuffled).
- Player hands, melds, exposed melds, bonus tiles.
- Discard pile with last discarded tile marked.
- Current player index and pending claim state.
- House rule configuration and bot difficulty.

## Error Handling / Edge Cases
- Rule profile load failures revert to defaults without crashing.
- If rule profiles are not writable, apply rules in-memory and log a warning.
- Prevent actions when it is not the player’s turn or when a claim is pending.
- Ensure UI updates (melds, hands, discards) stay consistent after claims.

## Acceptance Criteria
1. A user can complete a full single-hand round with legal draws, discards, and wins.
2. Win validity and fan calculation follow the simplified rules and respect the configured min fan and cap.
3. UI clearly presents available actions at each step and updates state after claims.
4. Bot difficulty affects discard/claim behavior in a noticeable way.
5. Rule profiles can be changed and persist across sessions.

