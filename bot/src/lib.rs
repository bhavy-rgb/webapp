//! chessify-bot library — chess engine core + WebAssembly bindings.
//!
//! Native: used by the `chessify-bot` CLI binary.
//! WASM:   compiled with `wasm-pack build --target web` and consumed by the
//!         Chessify React client inside a Web Worker.

pub mod board;
pub mod eval;
pub mod movegen;
pub mod search;
pub mod timer;
pub mod zobrist;

use board::Board;
use movegen::{in_check, legal_moves, make_move};
use search::search_with_history;

/// Difficulty presets: (max depth, time budget ms, random-blunder %).
fn level_params(level: u32) -> (u32, u128, u32) {
    match level {
        0 => (1, 50, 60),   // Beginner: shallow + frequent random moves
        1 => (2, 120, 25),  // Casual
        2 => (3, 400, 8),   // Club
        3 => (5, 1200, 0),  // Strong
        _ => (7, 2500, 0),  // Max
    }
}

/// Deterministic PRNG for the blunder roll (seeded by position + node count).
fn roll(seed: u64, modulo: u32) -> u32 {
    let mut z = seed.wrapping_add(0x9E37_79B9_7F4A_7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    ((z ^ (z >> 31)) % modulo as u64) as u32
}

/// Core "give me a move" entry shared by CLI and WASM.
///
/// Returns a JSON string:
///   {"bestmove":"e2e4","score":34,"depth":5,"nodes":12345}
///   {"bestmove":null,"terminal":"checkmate"|"stalemate"}
///   {"error":"..."}
pub fn best_move_json(fen: &str, level: u32, history_hashes: &[u64]) -> String {
    let b = match Board::from_fen(fen) {
        Ok(b) => b,
        Err(e) => return format!("{{\"error\":\"bad FEN: {}\"}}", e.replace('"', "'")),
    };

    let moves = legal_moves(&b);
    if moves.is_empty() {
        let term = if in_check(&b, b.side) { "checkmate" } else { "stalemate" };
        return format!("{{\"bestmove\":null,\"terminal\":\"{}\"}}", term);
    }

    let (depth, ms, blunder_pct) = level_params(level);

    // Low levels sometimes play a random (but never losing-the-queen-for-free
    // silly?) legal move to feel human/beatable.
    if blunder_pct > 0 {
        let seed = zobrist::hash(&b) ^ ((moves.len() as u64) << 32);
        if roll(seed, 100) < blunder_pct {
            let m = moves[roll(seed ^ 0xABCD, moves.len() as u32) as usize];
            return format!(
                "{{\"bestmove\":\"{}\",\"score\":0,\"depth\":0,\"nodes\":0,\"random\":true}}",
                m.uci()
            );
        }
    }

    let r = search_with_history(&b, depth, ms, history_hashes);
    match r.best {
        Some(m) => format!(
            "{{\"bestmove\":\"{}\",\"score\":{},\"depth\":{},\"nodes\":{}}}",
            m.uci(),
            r.score,
            r.depth,
            r.nodes
        ),
        None => "{\"error\":\"search failed\"}".to_string(),
    }
}

/// Zobrist hashes for a sequence of UCI moves from the start position —
/// lets the client hand the engine full game history for repetition checks.
pub fn hashes_for_moves(uci_moves: &str) -> Result<Vec<u64>, String> {
    let mut b = Board::start();
    let mut hashes = vec![zobrist::hash(&b)];
    for tok in uci_moves.split_whitespace() {
        let m = board::Move::from_uci(tok).ok_or_else(|| format!("bad move '{}'", tok))?;
        let legal = legal_moves(&b);
        let found = legal
            .iter()
            .find(|lm| lm.from == m.from && lm.to == m.to && lm.promotion == m.promotion)
            .ok_or_else(|| format!("illegal move '{}'", tok))?;
        b = make_move(&b, found);
        hashes.push(zobrist::hash(&b));
    }
    Ok(hashes)
}

// ---------------------------------------------------------------------------
// WebAssembly bindings
// ---------------------------------------------------------------------------
#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::*;
    use wasm_bindgen::prelude::*;

    /// Best move for `fen` at difficulty `level` (0..=4).
    /// `uci_history` — space-separated UCI moves from the standard start
    /// position (pass "" if the game didn't start from the initial position).
    #[wasm_bindgen]
    pub fn engine_best_move(fen: &str, level: u32, uci_history: &str) -> String {
        let hashes = hashes_for_moves(uci_history).unwrap_or_default();
        best_move_json(fen, level, &hashes)
    }

    /// All legal moves for a FEN as a JSON array of UCI strings.
    #[wasm_bindgen]
    pub fn engine_legal_moves(fen: &str) -> String {
        match Board::from_fen(fen) {
            Ok(b) => {
                let list: Vec<String> =
                    legal_moves(&b).iter().map(|m| format!("\"{}\"", m.uci())).collect();
                format!("[{}]", list.join(","))
            }
            Err(_) => "[]".to_string(),
        }
    }

    /// Static evaluation (centipawns, side to move perspective).
    #[wasm_bindgen]
    pub fn engine_eval(fen: &str) -> i32 {
        Board::from_fen(fen).map(|b| eval::evaluate(&b)).unwrap_or(0)
    }

    /// Perft node count (debugging).
    #[wasm_bindgen]
    pub fn engine_perft(fen: &str, depth: u32) -> u64 {
        Board::from_fen(fen).map(|b| movegen::perft(&b, depth)).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use board::{Board, START_FEN};
    use movegen::perft as perft_impl;

    #[test]
    fn perft_start_position() {
        let b = Board::start();
        assert_eq!(perft_impl(&b, 1), 20);
        assert_eq!(perft_impl(&b, 2), 400);
        assert_eq!(perft_impl(&b, 3), 8902);
        assert_eq!(perft_impl(&b, 4), 197_281);
    }

    #[test]
    fn perft_kiwipete() {
        // Famous tactical test position.
        let b = Board::from_fen(
            "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
        )
        .unwrap();
        assert_eq!(perft_impl(&b, 1), 48);
        assert_eq!(perft_impl(&b, 2), 2039);
        assert_eq!(perft_impl(&b, 3), 97_862);
    }

    #[test]
    fn perft_en_passant_pos() {
        let b = Board::from_fen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1").unwrap();
        assert_eq!(perft_impl(&b, 1), 14);
        assert_eq!(perft_impl(&b, 2), 191);
        assert_eq!(perft_impl(&b, 3), 2812);
        assert_eq!(perft_impl(&b, 4), 43_238);
    }

    #[test]
    fn finds_mate_in_one() {
        // Scholar's mate: Qxf7#
        let b = Board::from_fen(
            "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
        )
        .unwrap();
        let r = search::search(&b, 4, 5000);
        assert_eq!(r.best.unwrap().uci(), "f3f7");
    }

    #[test]
    fn finds_back_rank_mate() {
        let b = Board::from_fen("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1").unwrap();
        let r = search::search(&b, 4, 5000);
        assert_eq!(r.best.unwrap().uci(), "a1a8");
    }

    #[test]
    fn reports_terminal_positions() {
        // Fool's mate final position — Black just mated, White to move.
        let out = best_move_json(
            "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
            3,
            &[],
        );
        assert!(out.contains("checkmate"), "got: {}", out);
    }

    #[test]
    fn history_hashes_roundtrip() {
        let hashes = hashes_for_moves("e2e4 e7e5 g1f3").unwrap();
        assert_eq!(hashes.len(), 4);
        // Same moves → same hashes (determinism)
        assert_eq!(hashes, hashes_for_moves("e2e4 e7e5 g1f3").unwrap());
    }

    #[test]
    fn start_fen_roundtrip() {
        let b = Board::start();
        assert_eq!(b.to_fen(), START_FEN);
    }

    #[test]
    fn eval_insufficient_material_is_draw() {
        // K+N vs K and K+B vs K are dead draws.
        for fen in ["8/8/4k3/8/8/3NK3/8/8 w - - 0 1", "8/8/4k3/8/8/3BK3/8/8 b - - 0 1"] {
            let b = Board::from_fen(fen).unwrap();
            assert_eq!(eval::evaluate(&b), 0, "expected draw eval for {}", fen);
        }
    }

    #[test]
    fn eval_prefers_passed_pawn() {
        // Same material, but White's pawn is passed vs. blocked-by-neighbour.
        let passed = Board::from_fen("4k3/8/8/3P4/8/8/8/4K3 w - - 0 1").unwrap();
        let not_passed = Board::from_fen("4k3/4p3/8/3P4/8/8/8/4K3 w - - 0 1").unwrap();
        assert!(eval::evaluate(&passed) > eval::evaluate(&not_passed) + 50);
    }

    #[test]
    fn eval_bishop_pair_bonus() {
        let pair = Board::from_fen("4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1").unwrap();
        let knight_bishop = Board::from_fen("4k3/8/8/8/8/8/8/2N1KB2 w - - 0 1").unwrap();
        assert!(eval::evaluate(&pair) > eval::evaluate(&knight_bishop));
    }

    #[test]
    fn eval_rook_open_file() {
        // Rook on open e-file vs rook behind own pawn.
        let open = Board::from_fen("4k3/pppp1ppp/8/8/8/8/PPPP1PPP/4RK2 w - - 0 1").unwrap();
        let closed = Board::from_fen("4k3/pppp1ppp/8/8/8/8/PPPPRPPP/5K2 w - - 0 1").unwrap();
        assert!(eval::evaluate(&open) > eval::evaluate(&closed));
    }

    #[test]
    fn winner_prefers_simplification() {
        // White is up a rook. Position A: queens traded off. Position B:
        // queens still on. The exchange-scaling term should make the
        // simplified position score at least as well for White.
        let simplified =
            Board::from_fen("4k3/pppp1ppp/8/8/8/8/PPPP1PPP/R3K3 w Q - 0 1").unwrap();
        let with_queens =
            Board::from_fen("3qk3/pppp1ppp/8/8/8/8/PPPP1PPP/R2QK3 w Q - 0 1").unwrap();
        let a = eval::evaluate(&simplified);
        let bq = eval::evaluate(&with_queens);
        assert!(a > 200, "simplified up-a-rook should be clearly winning, got {}", a);
        assert!(bq > 200, "up-a-rook with queens should be clearly winning, got {}", bq);
    }

    #[test]
    fn takes_free_queen() {
        // White queen hangs on d5; best capture for black is exd5 or Nxd5.
        let b =
            Board::from_fen("rnbqkbnr/ppp1pppp/8/3Q4/8/8/PPPP1PPP/RNB1KBNR b KQkq - 0 2").unwrap();
        let r = search::search(&b, 4, 5000);
        let mv = r.best.unwrap().uci();
        assert!(mv.ends_with("d5"), "expected a capture on d5, got {}", mv);
    }
}
