//! Static evaluation, in centipawns from the side to move's perspective.
//!
//! Terms (informed by classical strategy literature on exchanges and
//! practical decision-making):
//!   - material + piece-square tables, tapered midgame→endgame by phase
//!   - exchange principle: when ahead in material, prefer trading *pieces*
//!     and keeping *pawns* (and the reverse when behind) — implemented as a
//!     winning-side scale factor that grows as non-pawn material comes off
//!   - bishop pair bonus
//!   - pawn structure: doubled, isolated, passed pawns (passers scale with
//!     rank and with how few pieces remain)
//!   - rooks on open / semi-open files, rook on 7th
//!   - king safety: pawn shield in the middlegame
//!   - simple mobility for minor pieces
//!   - insufficient-material draw recognition

use crate::board::*;

pub const MATE: i32 = 100_000;

pub fn piece_value(kind: PieceKind) -> i32 {
    match kind {
        PieceKind::Pawn => 100,
        PieceKind::Knight => 320,
        PieceKind::Bishop => 330,
        PieceKind::Rook => 500,
        PieceKind::Queen => 900,
        PieceKind::King => 0,
    }
}

/// Game-phase weight of a piece (queen 4, rook 2, minor 1). Total start = 24.
fn phase_weight(kind: PieceKind) -> i32 {
    match kind {
        PieceKind::Queen => 4,
        PieceKind::Rook => 2,
        PieceKind::Bishop | PieceKind::Knight => 1,
        _ => 0,
    }
}

// Piece-square tables from White's point of view (a1 = index 0).
#[rustfmt::skip]
const PAWN_PST: [i32; 64] = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10,-20,-20, 10, 10,  5,
     5, -5,-10,  0,  0,-10, -5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5,  5, 10, 25, 25, 10,  5,  5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
     0,  0,  0,  0,  0,  0,  0,  0,
];

#[rustfmt::skip]
const KNIGHT_PST: [i32; 64] = [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
];

#[rustfmt::skip]
const BISHOP_PST: [i32; 64] = [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
];

#[rustfmt::skip]
const ROOK_PST: [i32; 64] = [
     0,  0,  0,  5,  5,  0,  0,  0,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     5, 10, 10, 10, 10, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
];

#[rustfmt::skip]
const QUEEN_PST: [i32; 64] = [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -10,  5,  5,  5,  5,  5,  0,-10,
     0,  0,  5,  5,  5,  5,  0, -5,
    -5,  0,  5,  5,  5,  5,  0, -5,
   -10,  0,  5,  5,  5,  5,  0,-10,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
];

#[rustfmt::skip]
const KING_MID_PST: [i32; 64] = [
    20, 30, 10,  0,  0, 10, 30, 20,
    20, 20,  0,  0,  0,  0, 20, 20,
   -10,-20,-20,-20,-20,-20,-20,-10,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
];

#[rustfmt::skip]
const KING_END_PST: [i32; 64] = [
   -50,-30,-30,-30,-30,-30,-30,-50,
   -30,-30,  0,  0,  0,  0,-30,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-20,-10,  0,  0,-10,-20,-30,
   -50,-40,-30,-20,-20,-30,-40,-50,
];

/// Passed pawn bonus by (White-relative) rank.
const PASSED_BONUS: [i32; 8] = [0, 10, 15, 25, 40, 65, 100, 0];

fn mirror(sq: Square) -> usize {
    (7 - sq / 8) * 8 + sq % 8
}

fn pst_mid(kind: PieceKind, idx: usize) -> i32 {
    match kind {
        PieceKind::Pawn => PAWN_PST[idx],
        PieceKind::Knight => KNIGHT_PST[idx],
        PieceKind::Bishop => BISHOP_PST[idx],
        PieceKind::Rook => ROOK_PST[idx],
        PieceKind::Queen => QUEEN_PST[idx],
        PieceKind::King => KING_MID_PST[idx],
    }
}

fn pst_end(kind: PieceKind, idx: usize) -> i32 {
    match kind {
        PieceKind::King => KING_END_PST[idx],
        _ => pst_mid(kind, idx),
    }
}

/// Per-side accumulated features.
#[derive(Default)]
struct Side {
    mid: i32,
    end: i32,
    material: i32,      // non-king material (cp)
    pawn_material: i32, // pawn material only (cp)
    bishops: i32,
    /// Pawn count per file.
    pawn_files: [i32; 8],
    king_sq: Option<Square>,
    rooks: Vec<Square>,
    pawns: Vec<Square>,
    minors: Vec<Square>,
}

const KNIGHT_D: [(i32, i32); 8] =
    [(1, 2), (2, 1), (2, -1), (1, -2), (-1, -2), (-2, -1), (-2, 1), (-1, 2)];
const BISHOP_D: [(i32, i32); 4] = [(1, 1), (1, -1), (-1, -1), (-1, 1)];

fn offset(sq: Square, df: i32, dr: i32) -> Option<Square> {
    let file = (sq % 8) as i32 + df;
    let rank = (sq / 8) as i32 + dr;
    if (0..8).contains(&file) && (0..8).contains(&rank) {
        Some((rank * 8 + file) as usize)
    } else {
        None
    }
}

/// Cheap mobility count for a minor piece (squares reachable, friendly-blocked excluded).
fn minor_mobility(b: &Board, sq: Square, p: Piece) -> i32 {
    let mut n = 0;
    match p.kind {
        PieceKind::Knight => {
            for (df, dr) in KNIGHT_D {
                if let Some(t) = offset(sq, df, dr) {
                    if b.squares[t].map_or(true, |q| q.color != p.color) {
                        n += 1;
                    }
                }
            }
        }
        PieceKind::Bishop => {
            for (df, dr) in BISHOP_D {
                let mut cur = sq;
                while let Some(t) = offset(cur, df, dr) {
                    match b.squares[t] {
                        None => n += 1,
                        Some(q) => {
                            if q.color != p.color {
                                n += 1;
                            }
                            break;
                        }
                    }
                    cur = t;
                }
            }
        }
        _ => {}
    }
    n
}

fn collect(b: &Board, color: Color) -> Side {
    let mut s = Side::default();
    for sq in 0..64 {
        let p = match b.squares[sq] {
            Some(p) if p.color == color => p,
            _ => continue,
        };
        let idx = if color == Color::White { sq } else { mirror(sq) };
        s.mid += piece_value(p.kind) + pst_mid(p.kind, idx);
        s.end += piece_value(p.kind) + pst_end(p.kind, idx);
        s.material += piece_value(p.kind);
        match p.kind {
            PieceKind::Pawn => {
                s.pawn_material += 100;
                s.pawn_files[sq % 8] += 1;
                s.pawns.push(sq);
            }
            PieceKind::Bishop => {
                s.bishops += 1;
                s.minors.push(sq);
            }
            PieceKind::Knight => s.minors.push(sq),
            PieceKind::Rook => s.rooks.push(sq),
            PieceKind::King => s.king_sq = Some(sq),
            _ => {}
        }
    }
    s
}

/// Is the pawn on `sq` (of `color`) passed, given the enemy pawn file map + list?
fn is_passed(sq: Square, color: Color, enemy_pawns: &[Square]) -> bool {
    let file = (sq % 8) as i32;
    let rank = (sq / 8) as i32;
    !enemy_pawns.iter().any(|&e| {
        let ef = (e % 8) as i32;
        let er = (e / 8) as i32;
        (ef - file).abs() <= 1
            && if color == Color::White { er > rank } else { er < rank }
    })
}

/// Pawn-structure + rook-file + king-shield terms for one side.
/// Returns (mid, end) partial scores.
fn structure(b: &Board, us: &Side, them: &Side, color: Color, phase: i32) -> (i32, i32) {
    let mut mid = 0;
    let mut end = 0;

    // Bishop pair: worth more as the board opens up.
    if us.bishops >= 2 {
        mid += 30;
        end += 45;
    }

    // Pawn structure
    for f in 0..8usize {
        let n = us.pawn_files[f];
        if n > 1 {
            // doubled pawns
            mid -= 12 * (n - 1);
            end -= 20 * (n - 1);
        }
        if n > 0 {
            let left = if f > 0 { us.pawn_files[f - 1] } else { 0 };
            let right = if f < 7 { us.pawn_files[f + 1] } else { 0 };
            if left == 0 && right == 0 {
                // isolated
                mid -= 12 * n;
                end -= 16 * n;
            }
        }
    }

    // Passed pawns — the fewer enemy pieces remain, the stronger they are.
    for &sq in &us.pawns {
        if is_passed(sq, color, &them.pawns) {
            let rel_rank = if color == Color::White { sq / 8 } else { 7 - sq / 8 };
            let base = PASSED_BONUS[rel_rank];
            mid += base / 2;
            // scale endgame bonus up when the opponent has little material left
            let enemy_pieces = them.material - them.pawn_material;
            let scale = if enemy_pieces <= 300 { 3 } else if enemy_pieces <= 900 { 2 } else { 1 };
            end += base * scale / 2 + base / 2;
        }
    }

    // Rooks: open / semi-open files, 7th rank.
    for &sq in &us.rooks {
        let f = sq % 8;
        if us.pawn_files[f] == 0 {
            if them.pawn_files[f] == 0 {
                mid += 22; // open file
                end += 12;
            } else {
                mid += 12; // semi-open
                end += 6;
            }
        }
        let rel_rank = if color == Color::White { sq / 8 } else { 7 - sq / 8 };
        if rel_rank == 6 {
            mid += 20;
            end += 25;
        }
    }

    // King safety (midgame only): count friendly pawns in the 3 squares
    // directly in front of the king. Penalty fades with phase.
    if phase > 8 {
        if let Some(k) = us.king_sq {
            let dr = if color == Color::White { 1 } else { -1 };
            let mut shield = 0;
            for df in -1..=1 {
                if let Some(t) = offset(k, df, dr) {
                    if b.squares[t] == Some(Piece { kind: PieceKind::Pawn, color }) {
                        shield += 1;
                    }
                }
            }
            mid += match shield {
                0 => -30,
                1 => -12,
                2 => 0,
                _ => 8,
            };
        }
    }

    // Minor-piece mobility (both phases, small weight).
    for &sq in &us.minors {
        if let Some(p) = b.squares[sq] {
            let m = minor_mobility(b, sq, p);
            mid += (m - 4) * 3;
            end += (m - 4) * 2;
        }
    }

    (mid, end)
}

/// Insufficient mating material: K vs K, K+minor vs K, K+minor vs K+minor
/// (no pawns/rooks/queens anywhere).
fn insufficient_material(w: &Side, b: &Side) -> bool {
    let heavy = |s: &Side| s.pawn_material > 0 || s.material - s.pawn_material > 330;
    !heavy(w) && !heavy(b)
}

/// Static evaluation from the perspective of `b.side`.
pub fn evaluate(b: &Board) -> i32 {
    let white = collect(b, Color::White);
    let black = collect(b, Color::Black);

    if insufficient_material(&white, &black) {
        return 0;
    }

    // Phase 0 (endgame) .. 24 (opening).
    let mut phase = 0;
    for p in b.squares.iter().flatten() {
        phase += phase_weight(p.kind);
    }
    let phase = phase.min(24);

    let (w_mid_x, w_end_x) = structure(b, &white, &black, Color::White, phase);
    let (b_mid_x, b_end_x) = structure(b, &black, &white, Color::Black, phase);

    let mid = (white.mid + w_mid_x) - (black.mid + b_mid_x);
    let end = (white.end + w_end_x) - (black.end + b_end_x);

    // Tapered blend.
    let mut score = (mid * phase + end * (24 - phase)) / 24;

    // Exchange principle: the side that is ahead in material wants pieces
    // (not pawns) off the board. Amplify the advantage as non-pawn material
    // disappears, nudging the winner toward simplifying trades and the
    // loser toward keeping pieces on.
    let material_diff =
        (white.material - white.pawn_material) + white.pawn_material
            - black.material;
    if material_diff.abs() >= 150 {
        let total_pieces =
            (white.material - white.pawn_material) + (black.material - black.pawn_material);
        // 0 pieces left → +12%; full board (~6200) → +0%.
        let bonus = material_diff * (6200 - total_pieces.min(6200)) / 6200 * 12 / 100;
        score += bonus;
        // The winning side also wants to keep pawns (mating material / promotion fuel).
        let winner_pawns =
            if material_diff > 0 { white.pawn_material } else { black.pawn_material };
        let pawn_keep = (winner_pawns / 100).min(8) * 3;
        score += if material_diff > 0 { pawn_keep } else { -pawn_keep };
    }

    // Tempo.
    let tempo = 10;
    if b.side == Color::White {
        score + tempo
    } else {
        -score + tempo
    }
}
