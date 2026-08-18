//! Legal move generation: pseudo-legal generation + make-move + check filter.

use crate::board::*;

const KNIGHT_D: [(i32, i32); 8] =
    [(1, 2), (2, 1), (2, -1), (1, -2), (-1, -2), (-2, -1), (-2, 1), (-1, 2)];
const KING_D: [(i32, i32); 8] =
    [(0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1), (-1, 0), (-1, 1)];
const BISHOP_D: [(i32, i32); 4] = [(1, 1), (1, -1), (-1, -1), (-1, 1)];
const ROOK_D: [(i32, i32); 4] = [(0, 1), (1, 0), (0, -1), (-1, 0)];

fn offset(sq: Square, df: i32, dr: i32) -> Option<Square> {
    let file = (sq % 8) as i32 + df;
    let rank = (sq / 8) as i32 + dr;
    if (0..8).contains(&file) && (0..8).contains(&rank) {
        Some((rank * 8 + file) as usize)
    } else {
        None
    }
}

/// Is `sq` attacked by side `by`?
pub fn is_attacked(b: &Board, sq: Square, by: Color) -> bool {
    // Pawn attacks
    let dr = if by == Color::White { -1 } else { 1 }; // pawn sits one rank "behind" the target
    for df in [-1, 1] {
        if let Some(s) = offset(sq, df, dr) {
            if b.squares[s] == Some(Piece { kind: PieceKind::Pawn, color: by }) {
                return true;
            }
        }
    }
    // Knight
    for (df, dr) in KNIGHT_D {
        if let Some(s) = offset(sq, df, dr) {
            if b.squares[s] == Some(Piece { kind: PieceKind::Knight, color: by }) {
                return true;
            }
        }
    }
    // King
    for (df, dr) in KING_D {
        if let Some(s) = offset(sq, df, dr) {
            if b.squares[s] == Some(Piece { kind: PieceKind::King, color: by }) {
                return true;
            }
        }
    }
    // Sliding: bishop/queen diagonals
    for (df, dr) in BISHOP_D {
        let mut cur = sq;
        while let Some(s) = offset(cur, df, dr) {
            if let Some(p) = b.squares[s] {
                if p.color == by && (p.kind == PieceKind::Bishop || p.kind == PieceKind::Queen) {
                    return true;
                }
                break;
            }
            cur = s;
        }
    }
    // Sliding: rook/queen lines
    for (df, dr) in ROOK_D {
        let mut cur = sq;
        while let Some(s) = offset(cur, df, dr) {
            if let Some(p) = b.squares[s] {
                if p.color == by && (p.kind == PieceKind::Rook || p.kind == PieceKind::Queen) {
                    return true;
                }
                break;
            }
            cur = s;
        }
    }
    false
}

pub fn in_check(b: &Board, color: Color) -> bool {
    match b.king_square(color) {
        Some(k) => is_attacked(b, k, color.flip()),
        None => true, // no king = treat as lost
    }
}

fn push_pawn_move(moves: &mut Vec<Move>, from: Square, to: Square, color: Color) {
    let last_rank = if color == Color::White { 7 } else { 0 };
    if to / 8 == last_rank {
        for k in [PieceKind::Queen, PieceKind::Rook, PieceKind::Bishop, PieceKind::Knight] {
            moves.push(Move { from, to, promotion: Some(k) });
        }
    } else {
        moves.push(Move { from, to, promotion: None });
    }
}

/// All pseudo-legal moves for the side to move.
pub fn pseudo_legal(b: &Board) -> Vec<Move> {
    let mut moves = Vec::with_capacity(48);
    let us = b.side;

    for from in 0..64 {
        let piece = match b.squares[from] {
            Some(p) if p.color == us => p,
            _ => continue,
        };

        match piece.kind {
            PieceKind::Pawn => {
                let dir = if us == Color::White { 1 } else { -1 };
                let start_rank = if us == Color::White { 1 } else { 6 };
                // single push
                if let Some(one) = offset(from, 0, dir) {
                    if b.squares[one].is_none() {
                        push_pawn_move(&mut moves, from, one, us);
                        // double push
                        if from / 8 == start_rank {
                            if let Some(two) = offset(from, 0, 2 * dir) {
                                if b.squares[two].is_none() {
                                    moves.push(Move { from, to: two, promotion: None });
                                }
                            }
                        }
                    }
                }
                // captures + en passant
                for df in [-1, 1] {
                    if let Some(t) = offset(from, df, dir) {
                        match b.squares[t] {
                            Some(p) if p.color != us => push_pawn_move(&mut moves, from, t, us),
                            None if Some(t) == b.ep => {
                                moves.push(Move { from, to: t, promotion: None })
                            }
                            _ => {}
                        }
                    }
                }
            }
            PieceKind::Knight => {
                for (df, dr) in KNIGHT_D {
                    if let Some(t) = offset(from, df, dr) {
                        if b.squares[t].map_or(true, |p| p.color != us) {
                            moves.push(Move { from, to: t, promotion: None });
                        }
                    }
                }
            }
            PieceKind::King => {
                for (df, dr) in KING_D {
                    if let Some(t) = offset(from, df, dr) {
                        if b.squares[t].map_or(true, |p| p.color != us) {
                            moves.push(Move { from, to: t, promotion: None });
                        }
                    }
                }
                // Castling: king not in check, path empty + not attacked
                let (ks, qs, home) = match us {
                    Color::White => (WK, WQ, 4usize),
                    Color::Black => (BK, BQ, 60usize),
                };
                if from == home && !in_check(b, us) {
                    let them = us.flip();
                    if b.castling & ks != 0
                        && b.squares[home + 1].is_none()
                        && b.squares[home + 2].is_none()
                        && !is_attacked(b, home + 1, them)
                        && !is_attacked(b, home + 2, them)
                    {
                        moves.push(Move { from, to: home + 2, promotion: None });
                    }
                    if b.castling & qs != 0
                        && b.squares[home - 1].is_none()
                        && b.squares[home - 2].is_none()
                        && b.squares[home - 3].is_none()
                        && !is_attacked(b, home - 1, them)
                        && !is_attacked(b, home - 2, them)
                    {
                        moves.push(Move { from, to: home - 2, promotion: None });
                    }
                }
            }
            PieceKind::Bishop | PieceKind::Rook | PieceKind::Queen => {
                let dirs: &[(i32, i32)] = match piece.kind {
                    PieceKind::Bishop => &BISHOP_D,
                    PieceKind::Rook => &ROOK_D,
                    _ => &[BISHOP_D[0], BISHOP_D[1], BISHOP_D[2], BISHOP_D[3],
                           ROOK_D[0], ROOK_D[1], ROOK_D[2], ROOK_D[3]],
                };
                for &(df, dr) in dirs {
                    let mut cur = from;
                    while let Some(t) = offset(cur, df, dr) {
                        match b.squares[t] {
                            None => moves.push(Move { from, to: t, promotion: None }),
                            Some(p) => {
                                if p.color != us {
                                    moves.push(Move { from, to: t, promotion: None });
                                }
                                break;
                            }
                        }
                        cur = t;
                    }
                }
            }
        }
    }
    moves
}

/// Apply a move (assumed pseudo-legal) and return the new board.
pub fn make_move(b: &Board, m: &Move) -> Board {
    let mut nb = b.clone();
    let piece = nb.squares[m.from].expect("move from empty square");
    let us = piece.color;
    let captured = nb.squares[m.to];

    // halfmove clock
    if piece.kind == PieceKind::Pawn || captured.is_some() {
        nb.halfmove = 0;
    } else {
        nb.halfmove += 1;
    }

    // en passant capture removes the pawn behind the target
    if piece.kind == PieceKind::Pawn && Some(m.to) == nb.ep && captured.is_none() {
        let dir: i32 = if us == Color::White { -1 } else { 1 };
        let cap_sq = (m.to as i32 + dir * 8) as usize;
        nb.squares[cap_sq] = None;
        nb.halfmove = 0;
    }

    // move the piece (with promotion)
    nb.squares[m.from] = None;
    nb.squares[m.to] = Some(match m.promotion {
        Some(kind) => Piece { kind, color: us },
        None => piece,
    });

    // castling: move the rook too
    if piece.kind == PieceKind::King && (m.to as i32 - m.from as i32).abs() == 2 {
        let (rook_from, rook_to) = if m.to > m.from {
            (m.from + 3, m.from + 1) // king side
        } else {
            (m.from - 4, m.from - 1) // queen side
        };
        nb.squares[rook_to] = nb.squares[rook_from];
        nb.squares[rook_from] = None;
    }

    // update castling rights
    match (piece.kind, us) {
        (PieceKind::King, Color::White) => nb.castling &= !(WK | WQ),
        (PieceKind::King, Color::Black) => nb.castling &= !(BK | BQ),
        _ => {}
    }
    for sq in [m.from, m.to] {
        match sq {
            0 => nb.castling &= !WQ,
            7 => nb.castling &= !WK,
            56 => nb.castling &= !BQ,
            63 => nb.castling &= !BK,
            _ => {}
        }
    }

    // new en-passant square on double pawn push
    nb.ep = if piece.kind == PieceKind::Pawn && (m.to as i32 - m.from as i32).abs() == 16 {
        Some(((m.from + m.to) / 2) as usize)
    } else {
        None
    };

    if us == Color::Black {
        nb.fullmove += 1;
    }
    nb.side = us.flip();
    nb
}

/// Fully legal moves (king not left in check).
pub fn legal_moves(b: &Board) -> Vec<Move> {
    pseudo_legal(b)
        .into_iter()
        .filter(|m| !in_check(&make_move(b, m), b.side))
        .collect()
}

/// Perft node count — used to validate move generation.
pub fn perft(b: &Board, depth: u32) -> u64 {
    if depth == 0 {
        return 1;
    }
    let mut nodes = 0;
    for m in legal_moves(b) {
        nodes += perft(&make_move(b, &m), depth - 1);
    }
    nodes
}
