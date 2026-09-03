# ♟ chessify-bot — Chess Engine in Rust (native + WebAssembly)

A from-scratch chess engine built around **negamax alpha-beta search**,
written in pure Rust. It ships two ways:

- a **native CLI** (`chessify-bot`) for terminal play, analysis and testing
- a **WebAssembly library** consumed by the Chessify React client, running
  inside a Web Worker so search never blocks the UI

## Search

| Layer | Technique |
| --- | --- |
| Core | **Negamax minimax** with **alpha-beta pruning** |
| Memory | **Transposition table** (Zobrist-keyed, 256k entries, depth-preferred replacement) |
| Horizon | **Quiescence search** with **delta pruning** — never evaluates mid-exchange |
| Ordering | TT move → **MVV-LVA** captures → promotions → **killer moves** → **history heuristic** |
| Pruning | **Null-move pruning** (with zugzwang guard) + **late move reductions** |
| Extensions | **Check extensions** — forcing lines are searched deeper |
| Draws | **Threefold repetition** (full game history via Zobrist hashes) + fifty-move rule |
| Driver | **Iterative deepening** with a millisecond time budget |

Mate scores are distance-adjusted (`MATE - ply`) so the engine prefers the
fastest mate and delays being mated as long as possible.

## Evaluation

Tapered midgame/endgame evaluation (phase = remaining piece material):

- material + piece-square tables (separate king tables per phase)
- **exchange principle**: when ahead in material the score is scaled up as
  pieces (not pawns) come off — the winner is nudged toward simplifying
  trades and keeping pawns; the loser toward keeping pieces on
- **bishop pair** bonus (grows toward the endgame)
- **pawn structure**: doubled and isolated penalties; **passed pawns**
  scaled by rank and by how little enemy material remains
- **rooks** on open / semi-open files and on the 7th rank
- **king safety**: pawn-shield term in the middlegame
- minor-piece **mobility**
- **insufficient-material** draw recognition (K vs K, K+minor vs K, …)
- tempo bonus

## Difficulty levels (WASM/UI)

| Level | Depth | Budget | Behaviour |
| --- | --- | --- | --- |
| 0 Beginner | 1 | 50 ms | frequent casual moves |
| 1 Casual | 2 | 120 ms | occasional casual moves |
| 2 Club | 3 | 400 ms | rare slips |
| 3 Strong | 5 | 1.2 s | full strength, shallower |
| 4 Max | 7 | 2.5 s | full strength |

## Build & test

```bash
cd bot
cargo build --release
cargo test --release        # perft validation + tactics + eval regression tests

# WebAssembly package for the client (output → client/src/engine/pkg)
wasm-pack build --target web --release --out-dir ../client/src/engine/pkg
```

The move generator is validated with **perft**:
- start position depths 1–4 → 20 / 400 / 8 902 / 197 281 ✅
- Kiwipete (castling/EP/promotion torture position) depths 1–3 ✅
- en-passant test position depths 1–4 ✅

## CLI usage

```bash
BIN=target/release/chessify-bot

# Best move for a FEN (JSON output — easy to call from any backend)
$BIN bestmove "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" --depth 6 --ms 3000
# → {"bestmove":"b1c3","score":22,"depth":6,"nodes":31699}

# Interactive terminal game (you play White, UCI moves like e2e4)
$BIN play --depth 6

# Move-generator node count / static evaluation
$BIN perft "<FEN>" 5
$BIN eval "<FEN>"
```

## WASM API (used by `client/src/engine`)

```ts
engine_best_move(fen, level /* 0..4 */, uciHistory) // → JSON string
engine_legal_moves(fen)                             // → JSON array of UCI moves
engine_eval(fen)                                    // → centipawns (side to move)
engine_perft(fen, depth)                            // → bigint node count
```

`uciHistory` is the space-separated UCI move list from the initial position;
it lets the engine detect and avoid (or steer into) threefold repetition.
