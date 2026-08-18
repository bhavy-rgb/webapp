//! Zobrist hashing for transposition table + repetition detection.
//!
//! Keys are generated deterministically with SplitMix64 so native and
//! WASM builds agree.

use crate::board::*;
use std::sync::OnceLock;

pub struct Keys {
    /// [color][kind][square]
    pub pieces: [[[u64; 64]; 6]; 2],
    pub side_black: u64,
    pub castling: [u64; 16],
    /// en-passant file a..h
    pub ep_file: [u64; 8],
}

fn splitmix64(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

pub fn keys() -> &'static Keys {
    static KEYS: OnceLock<Keys> = OnceLock::new();
    KEYS.get_or_init(|| {
        let mut s: u64 = 0x00C0_FFEE_D00D_2026;
        let mut k = Keys {
            pieces: [[[0; 64]; 6]; 2],
            side_black: 0,
            castling: [0; 16],
            ep_file: [0; 8],
        };
        for c in 0..2 {
            for p in 0..6 {
                for sq in 0..64 {
                    k.pieces[c][p][sq] = splitmix64(&mut s);
                }
            }
        }
        k.side_black = splitmix64(&mut s);
        for i in 0..16 {
            k.castling[i] = splitmix64(&mut s);
        }
        for i in 0..8 {
            k.ep_file[i] = splitmix64(&mut s);
        }
        k
    })
}

fn kind_index(kind: PieceKind) -> usize {
    match kind {
        PieceKind::Pawn => 0,
        PieceKind::Knight => 1,
        PieceKind::Bishop => 2,
        PieceKind::Rook => 3,
        PieceKind::Queen => 4,
        PieceKind::King => 5,
    }
}

/// Full-board hash. Cheap relative to move generation (which already
/// scans all 64 squares and clones the board), and always correct.
pub fn hash(b: &Board) -> u64 {
    let k = keys();
    let mut h = 0u64;
    for sq in 0..64 {
        if let Some(p) = b.squares[sq] {
            let c = if p.color == Color::White { 0 } else { 1 };
            h ^= k.pieces[c][kind_index(p.kind)][sq];
        }
    }
    if b.side == Color::Black {
        h ^= k.side_black;
    }
    h ^= k.castling[(b.castling & 15) as usize];
    if let Some(ep) = b.ep {
        h ^= k.ep_file[ep % 8];
    }
    h
}
