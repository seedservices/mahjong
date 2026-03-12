# User Guide — Hong Kong Mahjong Web

## What This Is
Single-hand Hong Kong Mahjong in the browser. You play against three bots with simplified fan scoring.

## How To Run (Local)
```bash
npm install
npm run dev
```

## Basic Controls
- Click a tile in your hand to discard.
- Use the action buttons to claim `Chi`, `Pong`, `Kong`, or `Ron`.
- Use the `Self Draw` button when available to win.
- Click `New Round` to redeal.

## Difficulty & Rules
Open `Config` to adjust:
- Bot difficulty
- Rule profile
- Minimum fan and fan cap
- Self-draw and concealed bonuses

Rule profiles are loaded from `public/rule_profiles.json` and saved in localStorage.

## Win Conditions (Simplified)
You can win if your tiles match one of:
- Standard hand: 4 melds + 1 pair.
- Seven pairs.
- Thirteen orphans.

Wins must meet the minimum fan.

## Troubleshooting
- If tiles don’t render, ensure `public/assets/` exists and contains tile PNGs.
- If rule changes don’t persist, check browser storage permissions.

