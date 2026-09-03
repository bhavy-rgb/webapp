//! Board representation + FEN parsing/serialization.
//!
//! 8x8 mailbox: squares 0..64, a1 = 0, h8 = 63 (rank * 8 + file).

pub type Square = usize;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Color {
    White,
    Black,
}

impl Color {
    pub fn flip(self) -> Color {
        match self {
            Color::White => Color::Black,
            Color::Black => Color::White,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PieceKind {
    Pawn,
    Knight,
    Bishop,
    Rook,
    Queen,
    King,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Piece {
    pub kind: PieceKind,
    pub color: Color,
}

/// Castling rights bit flags.
pub const WK: u8 = 1;
pub const WQ: u8 = 2;
pub const BK: u8 = 4;
pub const BQ: u8 = 8;

#[derive(Clone)]
pub struct Board {
    pub squares: [Option<Piece>; 64],
    pub side: Color,
    pub castling: u8,
    pub ep: Option<Square>, // en-passant target square
    pub halfmove: u32,
    pub fullmove: u32,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Move {
    pub from: Square,
    pub to: Square,
    pub promotion: Option<PieceKind>,
}

impl Move {
    /// UCI notation, e.g. "e2e4", "e7e8q".
    pub fn uci(&self) -> String {
        let mut s = format!("{}{}", sq_name(self.from), sq_name(self.to));
        if let Some(p) = self.promotion {
            s.push(match p {
                PieceKind::Queen => 'q',
                PieceKind::Rook => 'r',
                PieceKind::Bishop => 'b',
                PieceKind::Knight => 'n',
                _ => 'q',
            });
        }
        s
    }

    /// Parse UCI notation.
    pub fn from_uci(s: &str) -> Option<Move> {
        let b = s.as_bytes();
        if b.len() < 4 {
            return None;
        }
        let from = sq_from_name(&s[0..2])?;
        let to = sq_from_name(&s[2..4])?;
        let promotion = if b.len() > 4 {
            Some(match b[4] {
                b'q' => PieceKind::Queen,
                b'r' => PieceKind::Rook,
                b'b' => PieceKind::Bishop,
                b'n' => PieceKind::Knight,
                _ => return None,
            })
        } else {
            None
        };
        Some(Move { from, to, promotion })
    }
}

pub fn sq_name(sq: Square) -> String {
    let file = (b'a' + (sq % 8) as u8) as char;
    let rank = (b'1' + (sq / 8) as u8) as char;
    format!("{}{}", file, rank)
}

pub fn sq_from_name(s: &str) -> Option<Square> {
    let b = s.as_bytes();
    if b.len() != 2 {
        return None;
    }
    let file = b[0].wrapping_sub(b'a') as usize;
    let rank = b[1].wrapping_sub(b'1') as usize;
    if file > 7 || rank > 7 {
        return None;
    }
    Some(rank * 8 + file)
}

pub const START_FEN: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

impl Board {
    pub fn start() -> Board {
        Board::from_fen(START_FEN).expect("valid start FEN")
    }

    pub fn from_fen(fen: &str) -> Result<Board, String> {
        let parts: Vec<&str> = fen.split_whitespace().collect();
        if parts.len() < 4 {
            return Err("FEN needs at least 4 fields".into());
        }

        let mut squares: [Option<Piece>; 64] = [None; 64];
        let mut rank: i32 = 7;
        let mut file: i32 = 0;
        for c in parts[0].chars() {
            match c {
                '/' => {
                    rank -= 1;
                    file = 0;
                }
                '1'..='8' => file += c.to_digit(10).unwrap() as i32,
                _ => {
                    if rank < 0 || file > 7 {
                        return Err("bad FEN board".into());
                    }
                    let color = if c.is_uppercase() { Color::White } else { Color::Black };
                    let kind = match c.to_ascii_lowercase() {
                        'p' => PieceKind::Pawn,
                        'n' => PieceKind::Knight,
                        'b' => PieceKind::Bishop,
                        'r' => PieceKind::Rook,
                        'q' => PieceKind::Queen,
                        'k' => PieceKind::King,
                        _ => return Err(format!("bad FEN piece '{}'", c)),
                    };
                    squares[(rank * 8 + file) as usize] = Some(Piece { kind, color });
                    file += 1;
                }
            }
        }

        let side = match parts[1] {
            "w" => Color::White,
            "b" => Color::Black,
            _ => return Err("bad side to move".into()),
        };

        let mut castling = 0u8;
        for c in parts[2].chars() {
            match c {
                'K' => castling |= WK,
                'Q' => castling |= WQ,
                'k' => castling |= BK,
                'q' => castling |= BQ,
                '-' => {}
                _ => return Err("bad castling field".into()),
            }
        }

        let ep = if parts[3] == "-" { None } else { sq_from_name(parts[3]) };
        let halfmove = parts.get(4).and_then(|s| s.parse().ok()).unwrap_or(0);
        let fullmove = parts.get(5).and_then(|s| s.parse().ok()).unwrap_or(1);

        Ok(Board { squares, side, castling, ep, halfmove, fullmove })
    }

    /// Serialize back to FEN (used by the test suite and future integrations).
    #[allow(dead_code)]
    pub fn to_fen(&self) -> String {
        let mut out = String::new();
        for rank in (0..8).rev() {
            let mut empty = 0;
            for file in 0..8 {
                match self.squares[rank * 8 + file] {
                    None => empty += 1,
                    Some(p) => {
                        if empty > 0 {
                            out.push_str(&empty.to_string());
                            empty = 0;
                        }
                        let ch = match p.kind {
                            PieceKind::Pawn => 'p',
                            PieceKind::Knight => 'n',
                            PieceKind::Bishop => 'b',
                            PieceKind::Rook => 'r',
                            PieceKind::Queen => 'q',
                            PieceKind::King => 'k',
                        };
                        out.push(if p.color == Color::White { ch.to_ascii_uppercase() } else { ch });
                    }
                }
            }
            if empty > 0 {
                out.push_str(&empty.to_string());
            }
            if rank > 0 {
                out.push('/');
            }
        }
        out.push(' ');
        out.push(if self.side == Color::White { 'w' } else { 'b' });
        out.push(' ');
        if self.castling == 0 {
            out.push('-');
        } else {
            if self.castling & WK != 0 { out.push('K'); }
            if self.castling & WQ != 0 { out.push('Q'); }
            if self.castling & BK != 0 { out.push('k'); }
            if self.castling & BQ != 0 { out.push('q'); }
        }
        out.push(' ');
        match self.ep {
            Some(sq) => out.push_str(&sq_name(sq)),
            None => out.push('-'),
        }
        out.push_str(&format!(" {} {}", self.halfmove, self.fullmove));
        out
    }

    pub fn king_square(&self, color: Color) -> Option<Square> {
        self.squares.iter().position(|p| {
            matches!(p, Some(Piece { kind: PieceKind::King, color: c }) if *c == color)
        })
    }
}
