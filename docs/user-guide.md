# User Guide — Hong Kong Mahjong Single-Hand (vs Bots)

## What This Is
Desktop single-hand Hong Kong Mahjong. You play one round against three computer players. The game handles draws, discards, calls, and simplified fan scoring.

## System Requirements
- Windows, macOS, or Linux
- Python 3

## Install
1. Create and activate a virtual environment (recommended):
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```
2. Install dependencies:
```powershell
pip install -r requirements.txt
```

## Run
```powershell
python app.py
```
Or on Windows, double-click `run_windows.bat`.

## Basic Controls
- Click a tile in your hand to discard.
- Use the action buttons to claim `chi`, `pong`, `kong`, or declare a win.
- Click `新開一局` to start a new round.
- Use the difficulty selector to adjust bot strength.
- Open `房規設定` to edit house rules.

## How a Turn Works
1. You draw a tile (hand becomes 14 tiles).
2. If you can win, the UI shows a win button with fan count.
3. You discard a tile by clicking it.
4. Other players may claim your discard (or you may be offered a claim on theirs).

## Calling (Chi / Pong / Kong / Win)
When a discard can be claimed, the UI shows buttons:
- `碰` (pong): three of a kind using the discard.
- `槓` (kong): four of a kind using the discard.
- `吃` (chi): sequence using the discard (only from the player to your left).
- `食糊` (ron): win using the discard.

If multiple actions are possible, choose one; the game proceeds with that action.

## Win Conditions (Simplified)
You can win if your tiles match one of:
- Standard hand: 4 melds + 1 pair.
- Seven pairs.
- Thirteen orphans.

Wins must meet the minimum fan set by house rules.

## Scoring (Fan)
Fan is computed from a limited set of patterns:
- Base win.
- Self-draw bonus (if enabled).
- Concealed hand bonus (if enabled).
- All pungs.
- Chow count.
- Suit bonuses (pure/mixed/ honors).
- Seven pairs / thirteen orphans.
- Flowers and seasons (1 fan each).

The fan total is capped by house rules.

## House Rules
Open `房規設定` to edit:
- Minimum fan
- Fan cap
- Self-draw bonus
- Concealed hand bonus

Profiles are saved to `rule_profiles.json`.

## Tips
- If the win button appears, you are eligible; you can still choose to discard instead.
- Higher difficulty bots claim more aggressively and pick safer discards.

## Troubleshooting
- If you see missing text or garbled CJK characters, install a CJK font and place it under `assets/fonts/`.
- If sound effects are missing, they will be auto-generated on first use.
- If rule profile changes do not persist, check file permissions on `rule_profiles.json`.

