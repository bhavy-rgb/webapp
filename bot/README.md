# ♟ chessify-bot — Minimax Chess Engine in Rust

A from-scratch chess engine built around the classic **minimax algorithm**
(in negamax form) with **alpha-beta pruning**, written in pure Rust with
zero dependencies.

## Algorithm

| Layer | Technique |
| --- | --- |
| Core search | **Minimax (negamax)** — explores the game tree assuming both sides play optimally |
| Pruning | **Alpha-beta** — cuts branches that cannot affect the final decision |
| Horizon | **Quiescence search** — keeps searching captures/promotions at leaf nodes so evaluation never lands mid-exchange |
| Move ordering | **MVV-LVA** (most valuable victim / least valuable attacker) + promotions first — maximizes alpha-beta cutoffs |
| Driver | **Iterative deepening** with a time budget — searches depth 1, 2, 3… and keeps the best move of the last completed depth |
| Evaluation | Material values + **piece-square tables** (separate king tables for middlegame/endgame), in centipawns |
| Rules | Full legal move generation: castling, en passant, promotion (all 4 pieces), fifty-move rule, checkmate/stalemate detection |

Mate scores are distance-adjusted (`MATE - ply`) so the engine prefers the
*fastest* mate and delays being mated as long as possible.

## Build & test

```bash
cd bot
cargo build --release
cargo test --release     # perft validation + tactics tests
```

The move generator is validated with **perft**:
- start position: depth 1–5 → 20 / 400 / 8 902 / 197 281 / 4 865 609 ✅
- Kiwipete (castling/EP/promo torture position): depth 1–3 ✅

## Usage

```bash
BIN=target/release/chessify-bot

# Best move for a FEN (JSON output — easy to call from any backend)
$BIN bestmove "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" --depth 5 --ms 3000
# → {"bestmove":"b1c3","score":40,"depth":5,"nodes":130136}

# Interactive game in the terminal (you play White, UCI moves like e2e4)
$BIN play --depth 5

# Move-generator node count (correctness benchmark)
$BIN perft "<FEN>" 5

# Static evaluation of a position (centipawns, side-to-move perspective)
$BIN eval "<FEN>"
```

### Flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `--depth N` | 5 | maximum search depth (plies) |
| `--ms T` | 3000 | time budget in milliseconds (iterative deepening stops when exceeded) |

## Structure

```
bot/
├── Cargo.toml
└── src/
    ├── board.rs     board state, FEN parse/serialize, UCI move notation
    ├── movegen.rs   legal move generation, make_move, attack detection, perft
    ├── eval.rs      material + piece-square-table evaluation
    ├── search.rs    negamax + alpha-beta + quiescence + iterative deepening
    └── main.rs      CLI (bestmove / play / perft / eval) + test suite
```

## Hooking it up to Chessify

`bestmove` prints a single JSON line, so the Express server can shell out to
the binary (or a future WASM build can run it in the browser) and replace the
current random-move bot:

```ts
import { execFile } from "node:child_process";
execFile("bot/target/release/chessify-bot", ["bestmove", fen, "--depth", "5"], (_, out) => {
  const { bestmove } = JSON.parse(out); // e.g. "e2e4"
});
```
