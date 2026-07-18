# FIDE Chess — Full Rules Chess Game

## Project Overview
- **Name**: FIDE Chess
- **Goal**: A fully playable, two-player (same device / pass-and-play) chess web app that implements the **official FIDE Laws of Chess** exactly — every rule from the uploaded `LawsOfChess.pdf` (Articles 1–5 and 9) is enforced by the engine, not just approximated.
- **Piece set**: `cburnett` (the same open-source piece style shown in the reference screenshot), sourced as SVGs so the board renders crisply at any size.

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
| 5.2b / 9.6 | **Dead position** (insufficient material: K v K, K+N v K, K+B v K, opposite-color-square bishops) → automatic draw | ✅ |
| 5.1b | Resignation | ✅ (button) |
| 5.2c | Draw by agreement | ✅ (button) |
| 9.2 | **Threefold repetition** — draw is *claimable* by a player (not automatic, per the Law) | ✅ (claim button appears when available) |
| 9.3 | **50-move rule** — draw is *claimable* once 50 full moves pass with no pawn move or capture | ✅ (claim button appears when available) |

Position-repetition tracking includes side to move, castling rights, and en passant availability, per the Law's exact definition of "the same position."

## URLs
- **Local dev preview**: http://localhost:3000 (inside sandbox)
- **Production**: Deploy with Cloudflare Pages (see Deployment section)

## Architecture
- **Backend**: Hono (Cloudflare Workers/Pages) — serves the HTML shell and static assets (`src/index.tsx`)
- **Chess engine**: `public/static/chess-engine.js` — pure, dependency-free JS class `ChessGame` implementing full FIDE move generation, legality checking, and game-end detection. Runs entirely client-side (no backend game state — this is a local two-player app, not networked).
- **UI controller**: `public/static/app.js` — wires clicks on the board to the engine, renders pieces/highlights/move list/captured pieces, and handles the promotion modal and draw-claim buttons.
- **Styling**: `public/static/style.css` — dark theme with a classic brown/cream board matching the reference design.
- **Piece art**: `public/static/pieces/*.svg` — 12 SVGs (cburnett set, same visual family as Lichess's default pieces).

## Data / Storage
- No database or persistence layer — this is a stateless, client-rendered single-page game. All game state (board, castling rights, en passant target, move history, repetition counts) lives in memory in the browser (`ChessGame` instance) and resets on "New Game" or page reload.

## User Guide
1. **Move a piece**: Click a piece of the side to move — legal destinations are highlighted (dot = quiet move, ring = capture). Click a highlighted square to move there.
2. **Castling**: Click the king and move it two squares toward the rook (as per Law 3.8a) when legal — the rook will jump automatically.
3. **En passant**: Available automatically for one move immediately after the opponent double-steps a pawn past your pawn.
4. **Promotion**: Move a pawn to the last rank — a modal lets you choose Queen/Rook/Bishop/Knight.
5. **Check / Checkmate / Stalemate**: The king's square glows red when in check; the game-over banner explains the exact result and cites the FIDE Article.
6. **Claim a draw**: "Claim Draw" buttons for threefold repetition / 50-move rule appear only once the condition is actually met, matching the Law (these are player-claimed, not automatic).
7. **Resign / Offer draw**: Buttons below the board for these results.
8. **Flip Board / Undo / New Game**: Utility controls.

## Testing
A Node-based test harness (`tests/run-tests.cjs`) exercises the engine directly (castling both sides, forfeiture after rook move, en passant + its expiry, promotion, stalemate, dead position, 50-move claim, threefold repetition, pin/check restrictions, and a full Fool's Mate to checkmate). Run with:
```bash
node tests/run-tests.cjs
```
All 72 assertions pass.

## Deployment
- **Platform**: Cloudflare Pages
- **Status**: Ready to deploy — not yet deployed to a public Cloudflare URL (ask to deploy)
- **Tech Stack**: Hono + TypeScript + vanilla JS chess engine + CSS
- **Last Updated**: 2026-07-18
