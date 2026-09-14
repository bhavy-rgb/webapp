//! Optional, original book-inspired heuristics. Never substitutes for search or
//! an endgame tablebase. Legacy evaluation and all search rules remain intact.
//! Rowson, Chess for Zebras, ch. 7 (Opportunity/Quality, pp. 110–137):
//! reward usable activity rather than development or color alone.
//! Nunn, Secrets of Rook Endings, section 4.2 (pp. 266–269):
//! king placement and lateral checking distance are position-dependent.
//! The weights below are experimental engineering choices, not book formulas.

use crate::board::{Board, Color, Piece, PieceKind, Square};
use crate::eval;

#[derive(Clone, Copy, Default, Debug, PartialEq, Eq)]
pub enum Profile {
    #[default]
    Legacy,
    Books,
}

impl Profile {
    pub fn evaluate(self, b: &Board) -> i32 {
        let base = eval::evaluate(b);
        if self == Self::Legacy {
            return base;
        }
        // Do not add scores to the legacy insufficient-material draw cases.
        if b.squares.iter().flatten().all(|p| matches!(p.kind, PieceKind::King | PieceKind::Bishop | PieceKind::Knight)) {
            return base;
        }
        let extra = features(b, Color::White) - features(b, Color::Black);
        base + if b.side == Color::White { extra } else { -extra }
    }
}

fn step(sq: Square, df: i32, dr: i32) -> Option<Square> {
    let f = (sq % 8) as i32 + df;
    let r = (sq / 8) as i32 + dr;
    ((0..8).contains(&f) && (0..8).contains(&r)).then_some((r * 8 + f) as usize)
}

fn pieces(b: &Board, color: Color, kind: PieceKind) -> Vec<Square> {
    (0..64).filter(|&s| b.squares[s] == Some(Piece { color, kind })).collect()
}

fn distance(a: Square, b: Square) -> i32 {
    ((a % 8) as i32 - (b % 8) as i32).abs().max(((a / 8) as i32 - (b / 8) as i32).abs())
}

fn relative_rank(s: Square, color: Color) -> usize {
    if color == Color::White { s / 8 } else { 7 - s / 8 }
}

fn pawn_attacks(b: &Board, color: Color) -> [bool; 64] {
    let mut map = [false; 64];
    for sq in pieces(b, color, PieceKind::Pawn) {
        for df in [-1, 1] {
            if let Some(t) = step(sq, df, if color == Color::White { 1 } else { -1 }) {
                map[t] = true;
            }
        }
    }
    map
}

/// Pseudo-mobility excluding hostile pawn control. Not claimed to be legal
/// mobility (pins and other attacks remain the search's responsibility).
fn usable_activity(b: &Board, color: Color) -> i32 {
    let danger = pawn_attacks(b, color.flip());
    let mut score = 0;
    for sq in 0..64 {
        let Some(p) = b.squares[sq].filter(|p| p.color == color) else { continue };
        let dirs: &[(i32, i32)] = match p.kind {
            PieceKind::Knight => &[(1,2),(2,1),(2,-1),(1,-2),(-1,-2),(-2,-1),(-2,1),(-1,2)],
            PieceKind::Bishop => &[(1,1),(1,-1),(-1,-1),(-1,1)],
            PieceKind::Rook => &[(1,0),(-1,0),(0,1),(0,-1)],
            PieceKind::Queen => &[(1,1),(1,-1),(-1,-1),(-1,1),(1,0),(-1,0),(0,1),(0,-1)],
            _ => continue,
        };
        for &(df, dr) in dirs {
            let mut cur = sq;
            while let Some(t) = step(cur, df, dr) {
                if b.squares[t].is_some_and(|q| q.color == color) { break; }
                if !danger[t] { score += 1; }
                if b.squares[t].is_some() || p.kind == PieceKind::Knight { break; }
                cur = t;
            }
        }
    }
    score
}

fn passed(b: &Board, pawn: Square, color: Color) -> bool {
    !pieces(b, color.flip(), PieceKind::Pawn).iter().any(|&other| {
        ((pawn % 8) as i32 - (other % 8) as i32).abs() <= 1
            && relative_rank(other, color) > relative_rank(pawn, color)
    })
}

/// Strictly empty intervening squares, with endpoints excluded.
fn clear_line(b: &Board, from: Square, to: Square) -> bool {
    if from == to || (from % 8 != to % 8 && from / 8 != to / 8) { return false; }
    let df = ((to % 8) as i32 - (from % 8) as i32).signum();
    let dr = ((to / 8) as i32 - (from / 8) as i32).signum();
    let mut cur = from;
    while let Some(t) = step(cur, df, dr) {
        if t == to { return true; }
        if b.squares[t].is_some() { return false; }
        cur = t;
    }
    false
}

fn rook_ending(b: &Board) -> bool {
    b.squares.iter().flatten().all(|p| matches!(p.kind, PieceKind::King | PieceKind::Pawn | PieceKind::Rook))
        && pieces(b, Color::White, PieceKind::Rook).len() == 1
        && pieces(b, Color::Black, PieceKind::Rook).len() == 1
}

fn rook_support(b: &Board, color: Color) -> i32 {
    let mut score = 0;
    for pawn_color in [color, color.flip()] {
        for pawn in pieces(b, pawn_color, PieceKind::Pawn) {
            if !passed(b, pawn, pawn_color) { continue; }
            for rook in pieces(b, color, PieceKind::Rook) {
                if rook % 8 == pawn % 8
                    && relative_rank(rook, pawn_color) < relative_rank(pawn, pawn_color)
                    && clear_line(b, rook, pawn) {
                    // Support own passer / pressure enemy passer from behind.
                    score += if pawn_color == color { 14 } else { 10 };
                }
            }
        }
    }
    score
}

fn king_escort(b: &Board, color: Color) -> i32 {
    let Some(&king) = pieces(b, color, PieceKind::King).first() else { return 0 };
    let Some(&enemy) = pieces(b, color.flip(), PieceKind::King).first() else { return 0 };
    let mut score = 0;
    for pawn in pieces(b, color, PieceKind::Pawn) {
        if !passed(b, pawn, color) { continue; }
        if let Some(next) = step(pawn, 0, if color == Color::White { 1 } else { -1 }) {
            score += (distance(enemy, next) - distance(king, next)) * 4;
        }
    }
    score
}

/// Defensive long-side checking geometry for KR+P versus KR only.
/// A small preference, NOT a Philidor/Lucena recognizer or a draw assertion.
fn checking_distance(b: &Board, defender: Color) -> i32 {
    if !pieces(b, defender, PieceKind::Pawn).is_empty() { return 0; }
    let pawns = pieces(b, defender.flip(), PieceKind::Pawn);
    if pawns.len() != 1 { return 0; }
    let pawn = pawns[0];
    let file = (pawn % 8) as i32;
    if file == 0 || file == 7 || relative_rank(pawn, defender.flip()) < 4 { return 0; }
    let Some(&king) = pieces(b, defender, PieceKind::King).first() else { return 0 };
    let Some(&enemy) = pieces(b, defender.flip(), PieceKind::King).first() else { return 0 };
    let Some(&rook) = pieces(b, defender, PieceKind::Rook).first() else { return 0 };
    let short_right = file >= 4;
    let king_short = if short_right { king % 8 > pawn % 8 } else { king % 8 < pawn % 8 };
    let rook_long = if short_right { rook % 8 < pawn % 8 } else { rook % 8 > pawn % 8 };
    let gap = ((rook % 8) as i32 - (enemy % 8) as i32).abs();
    if king_short && rook_long && gap >= 3
        && relative_rank(enemy, defender.flip()) >= relative_rank(pawn, defender.flip())
        && rook / 8 == enemy / 8 && clear_line(b, rook, enemy) {
        18 + gap * 2
    } else { 0 }
}

fn features(b: &Board, color: Color) -> i32 {
    let phase: i32 = b.squares.iter().flatten().map(|p| match p.kind {
        PieceKind::Queen => 4, PieceKind::Rook => 2,
        PieceKind::Knight | PieceKind::Bishop => 1, _ => 0,
    }).sum::<i32>().min(24);
    let activity = usable_activity(b, color) * phase / 24;
    let endgame = if rook_ending(b) {
        rook_support(b, color) + king_escort(b, color) + checking_distance(b, color)
    } else { 0 };
    activity + endgame
}

#[cfg(test)]
mod tests {
    use super::*;
    fn board(fen: &str) -> Board { Board::from_fen(fen).unwrap() }

    #[test]
    fn legacy_profile_is_exactly_unchanged() {
        for fen in [crate::board::START_FEN, "7k/8/8/3P4/8/8/6r1/3RK3 w - - 0 1"] {
            let b = board(fen);
            assert_eq!(Profile::Legacy.evaluate(&b), eval::evaluate(&b));
        }
    }
    #[test]
    fn preserves_dead_draws_and_start_symmetry() {
        assert_eq!(Profile::Books.evaluate(&board("8/8/4k3/8/8/3NK3/8/8 w - - 0 1")), 0);
        assert_eq!(Profile::Books.evaluate(&Board::start()), eval::evaluate(&Board::start()));
    }
    #[test]
    fn rook_support_requires_an_unblocked_passed_pawn() {
        let b = board("7k/8/8/3P4/8/8/6r1/3RK3 w - - 0 1");
        assert_eq!(rook_support(&b, Color::White), 14);
        let blocked = board("7k/8/8/3P4/8/3K4/6r1/3R4 w - - 0 1");
        assert_eq!(rook_support(&blocked, Color::White), 0);
        let opposed = board("7k/4p3/8/3P4/8/8/6r1/3RK3 w - - 0 1");
        assert_eq!(rook_support(&opposed, Color::White), 0);
    }
    #[test]
    fn king_near_passer_is_preferred() {
        let near = board("7k/8/3K4/3P4/8/8/6r1/3R4 w - - 0 1");
        let far = board("7k/8/8/3P4/8/8/6r1/3RK3 w - - 0 1");
        assert!(king_escort(&near, Color::White) > king_escort(&far, Color::White));
    }
    #[test]
    fn lateral_defence_requires_distance_short_side_king_and_clear_ray() {
        let b = board("8/r3K1k1/4P3/8/8/8/8/7R w - - 0 1");
        assert_eq!(checking_distance(&b, Color::Black), 26);
        let close = board("8/2r1K1k1/4P3/8/8/8/8/7R w - - 0 1");
        assert_eq!(checking_distance(&close, Color::Black), 0);
        let shield = board("8/r1R1K1k1/4P3/8/8/8/8/8 w - - 0 1");
        assert_eq!(checking_distance(&shield, Color::Black), 0);
        let wrong_side = board("8/r1k1K3/4P3/8/8/8/8/7R w - - 0 1");
        assert_eq!(checking_distance(&wrong_side, Color::Black), 0);
    }
    #[test]
    fn enemy_pawn_control_reduces_usable_activity() {
        let safe = board("4k3/8/p7/8/3N4/8/8/4K3 w - - 0 1");
        let unsafe_squares = board("4k3/8/4p3/8/3N4/8/8/4K3 w - - 0 1");
        assert!(usable_activity(&safe, Color::White) > usable_activity(&unsafe_squares, Color::White));
    }
    #[test]
    fn rook_terms_do_not_apply_to_middlegames_or_queen_endings() {
        assert!(!rook_ending(&Board::start()));
        assert!(!rook_ending(&board("7k/8/8/3P4/8/8/6r1/3QK3 w - - 0 1")));
    }
    #[test]
    fn color_mirroring_preserves_score() {
        for fen in [crate::board::START_FEN, "8/r3K1k1/4P3/8/8/8/8/7R w - - 0 1",
            "7k/8/8/3P4/8/8/6r1/3RK3 w - - 0 1"] {
            let b = board(fen);
            let mut mirrored = b.clone();
            for s in 0..64 {
                mirrored.squares[s ^ 56] = b.squares[s].map(|p| Piece {color: p.color.flip(), kind: p.kind});
            }
            mirrored.side = b.side.flip();
            assert_eq!(Profile::Books.evaluate(&b), Profile::Books.evaluate(&mirrored));
        }
    }
}
