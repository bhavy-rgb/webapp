//! Negamax alpha-beta search with:
//!   - iterative deepening + aspiration-free full windows
//!   - transposition table (Zobrist keyed)
//!   - quiescence search with delta pruning
//!   - MVV-LVA + killer moves + history heuristic move ordering
//!   - null-move pruning + late move reductions
//!   - check extensions
//!   - threefold-repetition awareness via caller-supplied hash history
//!
//! Works on both native and wasm32 targets (clock via `timer::now_ms`).

use crate::board::*;
use crate::eval::{evaluate, piece_value, MATE};
use crate::movegen::{in_check, legal_moves, make_move};
use crate::timer::now_ms;
use crate::zobrist::hash;

pub struct SearchResult {
    pub best: Option<Move>,
    pub score: i32,
    pub nodes: u64,
    pub depth: u32,
}

const MAX_PLY: usize = 96;

#[derive(Clone, Copy, PartialEq)]
enum Bound {
    Exact,
    Lower,
    Upper,
}

#[derive(Clone, Copy)]
struct TtEntry {
    key: u64,
    depth: i32,
    score: i32,
    bound: Bound,
    best: Option<Move>,
}

/// Fixed-size, always-replace-on-shallower transposition table.
struct Tt {
    entries: Vec<Option<TtEntry>>,
    mask: usize,
}

impl Tt {
    fn new(bits: u32) -> Tt {
        let size = 1usize << bits;
        Tt { entries: vec![None; size], mask: size - 1 }
    }
    fn probe(&self, key: u64) -> Option<&TtEntry> {
        self.entries[(key as usize) & self.mask]
            .as_ref()
            .filter(|e| e.key == key)
    }
    fn store(&mut self, e: TtEntry) {
        let idx = (e.key as usize) & self.mask;
        match &self.entries[idx] {
            Some(old) if old.key == e.key && old.depth > e.depth => {}
            _ => self.entries[idx] = Some(e),
        }
    }
}

struct Ctx {
    nodes: u64,
    start_ms: f64,
    time_limit_ms: f64,
    stop: bool,
    tt: Tt,
    killers: [[Option<Move>; 2]; MAX_PLY],
    history: [[i32; 64]; 64],
    /// Zobrist hashes of positions on the current search path + game history.
    path: Vec<u64>,
    /// Hashes of positions already seen in the game (for repetition draws).
    game_hashes: Vec<u64>,
}

impl Ctx {
    fn check_time(&mut self) {
        if self.nodes & 1023 == 0 && now_ms() - self.start_ms >= self.time_limit_ms {
            self.stop = true;
        }
    }

    /// Draw by repetition: position occurred before on the search path or
    /// at least twice in prior game history (making this the third).
    fn is_repetition(&self, h: u64) -> bool {
        if self.path.iter().rev().skip(1).any(|&x| x == h) {
            return true;
        }
        self.game_hashes.iter().filter(|&&x| x == h).count() >= 2
    }
}

fn mvv_lva(b: &Board, m: &Move) -> i32 {
    let mut s = 0;
    if let Some(victim) = b.squares[m.to] {
        let attacker = b.squares[m.from].map(|p| piece_value(p.kind)).unwrap_or(0);
        s += 100_000 + piece_value(victim.kind) * 16 - attacker;
    } else if m.promotion.is_some() {
        // quiet promotion still tactical
    }
    if let Some(p) = m.promotion {
        s += 90_000 + piece_value(p);
    }
    s
}

fn order_moves(
    b: &Board,
    moves: &mut [Move],
    tt_move: Option<Move>,
    killers: &[Option<Move>; 2],
    history: &[[i32; 64]; 64],
) {
    moves.sort_by_cached_key(|m| {
        let mut s = mvv_lva(b, m);
        if Some(*m) == tt_move {
            s += 1_000_000;
        } else if s == 0 {
            // quiet moves: killers then history
            if Some(*m) == killers[0] {
                s = 80_000;
            } else if Some(*m) == killers[1] {
                s = 79_000;
            } else {
                s = history[m.from][m.to].min(70_000);
            }
        }
        -s
    });
}

/// Quiescence: captures + promotions only, with delta pruning.
fn quiescence(b: &Board, mut alpha: i32, beta: i32, ctx: &mut Ctx) -> i32 {
    ctx.nodes += 1;
    ctx.check_time();
    if ctx.stop {
        return alpha;
    }

    let stand_pat = evaluate(b);
    if stand_pat >= beta {
        return beta;
    }
    if stand_pat > alpha {
        alpha = stand_pat;
    }

    let mut moves: Vec<Move> = legal_moves(b)
        .into_iter()
        .filter(|m| b.squares[m.to].is_some() || m.promotion.is_some())
        .collect();
    moves.sort_by_cached_key(|m| -mvv_lva(b, m));

    for m in moves {
        // Delta pruning: skip captures that can't possibly raise alpha.
        if let Some(victim) = b.squares[m.to] {
            if m.promotion.is_none() && stand_pat + piece_value(victim.kind) + 200 < alpha {
                continue;
            }
        }
        let nb = make_move(b, &m);
        let score = -quiescence(&nb, -beta, -alpha, ctx);
        if ctx.stop {
            return alpha;
        }
        if score >= beta {
            return beta;
        }
        if score > alpha {
            alpha = score;
        }
    }
    alpha
}

fn negamax(
    b: &Board,
    mut depth: i32,
    mut alpha: i32,
    beta: i32,
    ply: usize,
    allow_null: bool,
    ctx: &mut Ctx,
) -> i32 {
    ctx.nodes += 1;
    ctx.check_time();
    if ctx.stop || ply >= MAX_PLY - 1 {
        return evaluate(b);
    }

    if b.halfmove >= 100 {
        return 0; // fifty-move rule
    }

    let key = hash(b);
    if ply > 0 && ctx.is_repetition(key) {
        return 0; // draw by repetition
    }

    let in_chk = in_check(b, b.side);
    if in_chk {
        depth += 1; // check extension
    }

    // Transposition table probe
    let mut tt_move: Option<Move> = None;
    if let Some(e) = ctx.tt.probe(key) {
        tt_move = e.best;
        if ply > 0 && e.depth >= depth {
            match e.bound {
                Bound::Exact => return e.score,
                Bound::Lower if e.score >= beta => return e.score,
                Bound::Upper if e.score <= alpha => return e.score,
                _ => {}
            }
        }
    }

    if depth <= 0 {
        return quiescence(b, alpha, beta, ctx);
    }

    // Null-move pruning: give the opponent a free move; if we're still
    // above beta the position is almost certainly a cutoff. Skip when in
    // check or in pawn-only endgames (zugzwang risk).
    if allow_null && !in_chk && depth >= 3 && has_non_pawn_material(b) {
        let mut nb = b.clone();
        nb.side = nb.side.flip();
        nb.ep = None;
        let r = 2 + depth / 4;
        ctx.path.push(0); // null move breaks repetition chains
        let score = -negamax(&nb, depth - 1 - r, -beta, -beta + 1, ply + 1, false, ctx);
        ctx.path.pop();
        if ctx.stop {
            return alpha;
        }
        if score >= beta {
            return beta;
        }
    }

    let mut moves = legal_moves(b);
    if moves.is_empty() {
        return if in_chk { -MATE + ply as i32 } else { 0 };
    }

    order_moves(b, &mut moves, tt_move, &ctx.killers[ply], &ctx.history);

    let alpha_orig = alpha;
    let mut best_score = -MATE - 1;
    let mut best_move: Option<Move> = None;

    for (i, m) in moves.iter().enumerate() {
        let is_capture = b.squares[m.to].is_some();
        let nb = make_move(b, m);
        let child_key = hash(&nb);
        ctx.path.push(child_key);

        let gives_check = in_check(&nb, nb.side);
        let mut score;
        if i == 0 {
            score = -negamax(&nb, depth - 1, -beta, -alpha, ply + 1, true, ctx);
        } else {
            // Late move reductions for quiet, non-checking moves.
            let mut red = 0;
            if depth >= 3 && i >= 4 && !is_capture && m.promotion.is_none() && !gives_check && !in_chk
            {
                red = 1 + (i as i32 / 8).min(2);
            }
            score = -negamax(&nb, depth - 1 - red, -(alpha + 1), -alpha, ply + 1, true, ctx);
            if score > alpha && red > 0 {
                score = -negamax(&nb, depth - 1, -(alpha + 1), -alpha, ply + 1, true, ctx);
            }
            if score > alpha && score < beta {
                score = -negamax(&nb, depth - 1, -beta, -alpha, ply + 1, true, ctx);
            }
        }
        ctx.path.pop();

        if ctx.stop {
            break;
        }
        if score > best_score {
            best_score = score;
            best_move = Some(*m);
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            // Store killer + history for quiet cutoff moves.
            if !is_capture && m.promotion.is_none() {
                if ctx.killers[ply][0] != Some(*m) {
                    ctx.killers[ply][1] = ctx.killers[ply][0];
                    ctx.killers[ply][0] = Some(*m);
                }
                let h = &mut ctx.history[m.from][m.to];
                *h += depth * depth;
                if *h > 60_000 {
                    *h /= 2;
                }
            }
            break;
        }
    }

    if !ctx.stop {
        let bound = if best_score <= alpha_orig {
            Bound::Upper
        } else if best_score >= beta {
            Bound::Lower
        } else {
            Bound::Exact
        };
        ctx.tt.store(TtEntry { key, depth, score: best_score, bound, best: best_move });
    }

    best_score
}

fn has_non_pawn_material(b: &Board) -> bool {
    b.squares.iter().flatten().any(|p| {
        p.color == b.side
            && matches!(
                p.kind,
                PieceKind::Knight | PieceKind::Bishop | PieceKind::Rook | PieceKind::Queen
            )
    })
}

/// Iterative-deepening driver.
///
/// `game_hashes` — Zobrist hashes of every position that occurred earlier in
/// the game (enables true threefold-repetition avoidance). Pass `&[]` if
/// unknown.
pub fn search_with_history(
    b: &Board,
    max_depth: u32,
    time_limit_ms: u128,
    game_hashes: &[u64],
) -> SearchResult {
    let mut ctx = Ctx {
        nodes: 0,
        start_ms: now_ms(),
        time_limit_ms: time_limit_ms as f64,
        stop: false,
        tt: Tt::new(18), // 262144 entries
        killers: [[None; 2]; MAX_PLY],
        history: [[0; 64]; 64],
        path: vec![hash(b)],
        game_hashes: game_hashes.to_vec(),
    };
    let mut result = SearchResult { best: None, score: 0, nodes: 0, depth: 0 };

    let root_moves = legal_moves(b);
    if root_moves.is_empty() {
        return result;
    }
    if root_moves.len() == 1 {
        return SearchResult { best: Some(root_moves[0]), score: 0, nodes: 1, depth: 1 };
    }

    for depth in 1..=max_depth as i32 {
        let mut moves = root_moves.clone();
        let tt_move = result.best;
        order_moves(b, &mut moves, tt_move, &ctx.killers[0], &ctx.history);

        let mut alpha = -MATE - 1;
        let beta = MATE + 1;
        let mut iter_best: Option<Move> = None;

        for m in &moves {
            let nb = make_move(b, m);
            ctx.path.push(hash(&nb));
            let score = -negamax(&nb, depth - 1, -beta, -alpha, 1, true, &mut ctx);
            ctx.path.pop();
            if ctx.stop {
                break;
            }
            if score > alpha {
                alpha = score;
                iter_best = Some(*m);
            }
        }

        if ctx.stop {
            break; // keep previous fully-completed iteration
        }
        if iter_best.is_none() {
            iter_best = Some(moves[0]);
        }
        result =
            SearchResult { best: iter_best, score: alpha, nodes: ctx.nodes, depth: depth as u32 };

        if alpha.abs() >= MATE - 200 {
            break; // forced mate found
        }
    }

    if result.best.is_none() {
        result.best = Some(root_moves[0]);
        result.depth = 1;
    }
    result.nodes = ctx.nodes;
    result
}

/// Back-compat wrapper (no game history).
pub fn search(b: &Board, max_depth: u32, time_limit_ms: u128) -> SearchResult {
    search_with_history(b, max_depth, time_limit_ms, &[])
}
