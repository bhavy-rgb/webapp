//! Minimax search in negamax form with alpha-beta pruning,
//! quiescence search, MVV-LVA move ordering and iterative deepening.

use crate::board::*;
use crate::eval::{evaluate, piece_value, MATE};
use crate::movegen::{in_check, legal_moves, make_move};
use std::time::Instant;

pub struct SearchResult {
    pub best: Option<Move>,
    pub score: i32,
    pub nodes: u64,
    pub depth: u32,
}

struct Ctx {
    nodes: u64,
    start: Instant,
    time_limit_ms: u128,
    stop: bool,
}

impl Ctx {
    fn check_time(&mut self) {
        // Cheap check every 2048 nodes.
        if self.nodes & 2047 == 0 && self.start.elapsed().as_millis() >= self.time_limit_ms {
            self.stop = true;
        }
    }
}

/// MVV-LVA: order captures by most-valuable-victim / least-valuable-attacker,
/// promotions high, quiets last.
fn score_move(b: &Board, m: &Move) -> i32 {
    let mut s = 0;
    if let Some(victim) = b.squares[m.to] {
        let attacker = b.squares[m.from].map(|p| piece_value(p.kind)).unwrap_or(0);
        s += 10_000 + piece_value(victim.kind) * 10 - attacker;
    }
    if let Some(p) = m.promotion {
        s += 9_000 + piece_value(p);
    }
    s
}

fn order_moves(b: &Board, moves: &mut [Move]) {
    moves.sort_by_cached_key(|m| -score_move(b, m));
}

/// Quiescence: only search captures/promotions at the horizon so the
/// evaluation is never taken in the middle of an exchange.
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
    order_moves(b, &mut moves);

    for m in moves {
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

/// Negamax minimax with alpha-beta pruning.
fn negamax(b: &Board, depth: u32, mut alpha: i32, beta: i32, ply: i32, ctx: &mut Ctx) -> i32 {
    ctx.nodes += 1;
    ctx.check_time();
    if ctx.stop {
        return alpha;
    }

    if b.halfmove >= 100 {
        return 0; // fifty-move rule
    }

    let mut moves = legal_moves(b);
    if moves.is_empty() {
        return if in_check(b, b.side) {
            -MATE + ply // checkmate: prefer faster mates
        } else {
            0 // stalemate
        };
    }

    if depth == 0 {
        return quiescence(b, alpha, beta, ctx);
    }

    order_moves(b, &mut moves);

    let mut best = -MATE - 1;
    for m in moves {
        let nb = make_move(b, &m);
        let score = -negamax(&nb, depth - 1, -beta, -alpha, ply + 1, ctx);
        if ctx.stop {
            break;
        }
        if score > best {
            best = score;
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            break; // beta cutoff
        }
    }
    best
}

/// Iterative deepening driver: search depth 1, 2, ... until max depth or
/// the time budget runs out; always keeps the best move of the last
/// fully-completed iteration.
pub fn search(b: &Board, max_depth: u32, time_limit_ms: u128) -> SearchResult {
    let mut ctx = Ctx { nodes: 0, start: Instant::now(), time_limit_ms, stop: false };
    let mut result =
        SearchResult { best: None, score: 0, nodes: 0, depth: 0 };

    for depth in 1..=max_depth {
        let mut moves = legal_moves(b);
        if moves.is_empty() {
            break;
        }
        order_moves(b, &mut moves);

        // Search best move from previous iteration first.
        if let Some(prev) = result.best {
            if let Some(pos) = moves.iter().position(|m| *m == prev) {
                moves.swap(0, pos);
            }
        }

        let mut alpha = -MATE - 1;
        let beta = MATE + 1;
        let mut iter_best: Option<Move> = None;

        for m in &moves {
            let nb = make_move(b, m);
            let score = -negamax(&nb, depth - 1, -beta, -alpha, 1, &mut ctx);
            if ctx.stop {
                break;
            }
            if score > alpha {
                alpha = score;
                iter_best = Some(*m);
            }
        }

        if ctx.stop {
            // Keep the previous fully-completed iteration's answer.
            break;
        }
        if iter_best.is_none() {
            iter_best = Some(moves[0]);
        }
        result = SearchResult { best: iter_best, score: alpha, nodes: ctx.nodes, depth };

        // Found a forced mate — no need to search deeper.
        if alpha.abs() >= MATE - 100 {
            break;
        }
    }

    result.nodes = ctx.nodes;
    result
}
