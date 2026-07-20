# FIDE Chess — Full Rules Chess Game

## Project Overview
- **Name**: FIDE Chess
- **Goal**: A fully playable chess web app that implements the **official FIDE Laws of Chess** exactly (Articles 1–5 and 9), now with three game modes:
  1. **Pass & Play** — two players on the same device
  2. **Play Against Maia** — a human-like bot with 7 rating levels (600–1900)
  3. **Play a Friend Online** — create a game, share a 6-character code / invite link
- **Piece set**: `cburnett` (open-source SVGs, the Lichess default piece family)

## Game Modes

### 🤖 Play Against Maia
Inspired by [CSSLab/maia-chess](https://github.com/CSSLab/maia-chess) — Maia is a neural network trained to play like *humans* at specific rating levels rather than playing the objectively best move.

> **Implementation note**: the real Maia networks require lc0 (Leela Chess Zero) GPU inference, which cannot run on Cloudflare Pages or in the browser. This app reproduces Maia's defining behaviour — "play the move a human of rating X would play" — with a classical alpha-beta evaluation plus **softmax (probability-weighted) move selection** whose temperature, search depth and blunder rate are calibrated per rating level (`public/static/maia-bot.js`).

Configuration dialog (matches the reference design):
- **Opponent**: Maia 600 / 900 / 1100 / 1300 / 1500 / 1700 / 1900
- **Time Control**: presets 3+0, 5+2, 10+0, 15+10, Unlimited — or custom via Time/Increment sliders
- **Maia thinking time**: Instant or Human-like (natural, rating-scaled delays)
- **Start from custom position**: paste any FEN
- **Choose your color**: White / Black / Random

### 🌐 Play a Friend Online
- **Create Game** → get a 6-char code (e.g. `AB3XY9`) + copyable invite link (`/?game=AB3XY9`)
- **Join Game** → enter the friend's code (or just open the invite link)
- Time controls with server-authoritative clocks + increment; flag fall detected server-side
- Moves sync by polling every 2s; turn order and player identity enforced server-side (secret per-player tokens)
- Resign, draw offers (accept/decline), and claimable FIDE draws (threefold / 50-move) all supported online

### 👥 Pass & Play
The original local two-player mode, with undo, flip board, resign, agreed draws and draw claims.

## Rules Implemented (mapped to FIDE Articles)
| Article | Rule | Status |
|---|---|---|
| 2 | Initial position of pieces | ✅ |
| 3.1–3.6 | Legal moves for K, Q, R, B, N (incl. blocked sliding paths) | ✅ |
| 3.7a–c | Pawn forward move, double-step from start rank, diagonal capture | ✅ |
| 3.7d | **En passant** capture (only immediately after opponent's double pawn push) | ✅ |
| 3.7e | **Pawn promotion** (Q/R/B/N choice via modal) | ✅ |
| 3.8a–b | **Castling** (king/queen-side), forfeited once king or that rook has moved, and blocked if king's start/transit/destination square is attacked or squares between are occupied | ✅ |
| 4 | A move is only legal if it does not leave the mover's own king in check (pin/check detection) | ✅ |
| 5.1a | **Checkmate** detection ends the game | ✅ |
| 5.2a | **Stalemate** → draw | ✅ |
| 5.2b / 9.6 | **Dead position** (insufficient material) → automatic draw | ✅ |
| 5.1b | Resignation | ✅ |
| 5.2c | Draw by agreement | ✅ |
| 9.2 | **Threefold repetition** — draw is *claimable* by a player (not automatic, per the Law) | ✅ |
| 9.3 | **50-move rule** — draw is *claimable* once 50 full moves pass with no pawn move or capture | ✅ |

Position-repetition tracking includes side to move, castling rights, and en passant availability, per the Law's exact definition of "the same position."

## URLs
- **GitHub**: https://github.com/bhavy-rgb/webapp
- **Local dev preview**: http://localhost:3000 (inside sandbox)
- **Production**: Deploy with Cloudflare Pages (see Deployment section)

## API Endpoints (online friend games)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/games` | Create game `{color, timeMinutes, incrementSeconds}` → `{code, token, color}` |
| POST | `/api/games/:code/join` | Join as the remaining color → `{token, color}` |
| GET | `/api/games/:code/state` | Poll state: moves, clocks, status, result, draw offer |
| POST | `/api/games/:code/move` | Submit a move `{token, move:{from,to,promotion}, moveIndex, result?}` |
| POST | `/api/games/:code/resign` | Resign `{token}` |
| POST | `/api/games/:code/draw` | `{token, action: offer\|accept\|decline\|claim, reason?}` |

## Architecture
- **Backend**: Hono (Cloudflare Pages/Workers) — serves the HTML shell, static assets, and the friend-game REST API (`src/index.tsx`)
- **Chess engine**: `public/static/chess-engine.js` — pure, dependency-free `ChessGame` class implementing full FIDE move generation, legality checking, game-end detection, and FEN import/export
- **Maia bot**: `public/static/maia-bot.js` — rating-calibrated human-like move selection (depth 1–4 alpha-beta + temperature softmax + blunder model), levels 600–1900
- **UI controller**: `public/static/app.js` — mode menu, board interaction, clocks, Maia scheduling, online polling/sync, config modals
- **Styling**: `public/static/style.css` — dark theme, brown/cream board, config modals matching the reference design

## Data Architecture
- **Storage**: Cloudflare **D1** (SQLite) — single `games` table for online friend games (code, per-player secret tokens, JSON move list, clocks, status/result, draw offers). See `migrations/0001_online_games.sql`.
- **Local & Maia games**: fully client-side, no persistence (state resets on New Game / reload)
- **Data flow**: both clients run the identical FIDE engine and validate every move; the server enforces turn order, identity (tokens), clock accounting and results

## User Guide
1. Pick a mode from the menu: **Pass & Play**, **Play Against Maia**, or **Play a Friend Online**.
2. **Maia**: pick level, time control, thinking-time style, optional FEN start position and your color → Start Game.
3. **Friend game**: Create → share the code or "Copy invite link"; your friend opens the link (or Join Game → enter code). The board auto-syncs.
4. **Moving**: click a piece — legal destinations are highlighted (dot = quiet move, ring = capture). Castle by moving the king two squares. Promotion opens a Q/R/B/N modal.
5. **Clocks**: shown when a time control is set; the active player's clock is highlighted, low time turns red, flag fall ends the game.
6. **Draws**: claim buttons for threefold/50-move appear only when actually available (per the Law); online games also support offer/accept/decline.

## Development
```bash
npm install
npm run build
npx wrangler d1 migrations apply webapp-production --local   # set up local D1
npx wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 3000
```

## Testing
```bash
node tests/run-tests.cjs   # 72 assertions: castling, en passant, promotion, stalemate,
                           # dead position, 50-move, repetition, pins, Fool's Mate
```
All 72 assertions pass. The Maia bot and FEN support are additionally verified for move legality at every level and mate-finding at high levels.

## Deployment
- **Platform**: Cloudflare Pages + D1
- **Status**: Ready to deploy — create a production D1 database (`npx wrangler d1 create webapp-production`), put its `database_id` into `wrangler.jsonc`, apply migrations, then `npm run deploy`
- **Tech Stack**: Hono + TypeScript + vanilla JS chess engine + Cloudflare D1
- **Last Updated**: 2026-07-20
