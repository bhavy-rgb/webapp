//! chessify-bot — a minimax (alpha-beta) chess engine CLI.
//!
//! Usage:
//!   chessify-bot bestmove "<FEN>" [--depth N] [--ms T]   best move for the position
//!   chessify-bot play [--depth N]                        interactive: you type UCI moves
//!   chessify-bot perft "<FEN>" <depth>                   move-generator node count
//!   chessify-bot eval "<FEN>"                            static evaluation
//!
//! Output of `bestmove` is JSON: {"bestmove":"e2e4","score":34,"depth":5,"nodes":12345}

mod board;
mod eval;
mod movegen;
mod search;

use board::{Board, Move, START_FEN};
use movegen::{in_check, legal_moves, make_move, perft};
use search::search;
use std::io::{self, BufRead, Write};

const DEFAULT_DEPTH: u32 = 5;
const DEFAULT_MS: u128 = 3000;

fn parse_flag<T: std::str::FromStr>(args: &[String], flag: &str, default: T) -> T {
    args.iter()
        .position(|a| a == flag)
        .and_then(|i| args.get(i + 1))
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn cmd_bestmove(fen: &str, depth: u32, ms: u128) {
    let b = match Board::from_fen(fen) {
        Ok(b) => b,
        Err(e) => {
            println!("{{\"error\":\"bad FEN: {}\"}}", e);
            std::process::exit(1);
        }
    };
    let r = search(&b, depth, ms);
    match r.best {
        Some(m) => println!(
            "{{\"bestmove\":\"{}\",\"score\":{},\"depth\":{},\"nodes\":{}}}",
            m.uci(),
            r.score,
            r.depth,
            r.nodes
        ),
        None => {
            let term = if in_check(&b, b.side) { "checkmate" } else { "stalemate" };
            println!("{{\"bestmove\":null,\"terminal\":\"{}\"}}", term);
        }
    }
}

fn print_board(b: &Board) {
    use board::{Color, PieceKind};
    for rank in (0..8).rev() {
        print!("{} ", rank + 1);
        for file in 0..8 {
            let c = match b.squares[rank * 8 + file] {
                None => '.',
                Some(p) => {
                    let ch = match p.kind {
                        PieceKind::Pawn => 'p',
                        PieceKind::Knight => 'n',
                        PieceKind::Bishop => 'b',
                        PieceKind::Rook => 'r',
                        PieceKind::Queen => 'q',
                        PieceKind::King => 'k',
                    };
                    if p.color == Color::White { ch.to_ascii_uppercase() } else { ch }
                }
            };
            print!("{} ", c);
        }
        println!();
    }
    println!("  a b c d e f g h");
}

fn cmd_play(depth: u32, ms: u128) {
    let mut b = Board::start();
    let stdin = io::stdin();
    println!("chessify-bot — you are White. Enter moves in UCI (e.g. e2e4). 'quit' to exit.");
    print_board(&b);

    loop {
        // Human move
        print!("> ");
        io::stdout().flush().ok();
        let mut line = String::new();
        if stdin.lock().read_line(&mut line).unwrap_or(0) == 0 {
            break;
        }
        let input = line.trim();
        if input == "quit" || input == "exit" {
            break;
        }
        let mv = match Move::from_uci(input) {
            Some(m) => m,
            None => {
                println!("Could not parse '{}'. Use UCI like e2e4 or e7e8q.", input);
                continue;
            }
        };
        let legal = legal_moves(&b);
        let Some(chosen) = legal.iter().find(|m| {
            m.from == mv.from && m.to == mv.to && (mv.promotion.is_none() || m.promotion == mv.promotion)
        }) else {
            println!("Illegal move.");
            continue;
        };
        b = make_move(&b, chosen);
        print_board(&b);
        if legal_moves(&b).is_empty() {
            println!("{}", if in_check(&b, b.side) { "Checkmate — you win!" } else { "Stalemate." });
            break;
        }

        // Bot reply
        let r = search(&b, depth, ms);
        match r.best {
            Some(m) => {
                println!("bot: {} (score {}, depth {}, {} nodes)", m.uci(), r.score, r.depth, r.nodes);
                b = make_move(&b, &m);
                print_board(&b);
                if legal_moves(&b).is_empty() {
                    println!("{}", if in_check(&b, b.side) { "Checkmate — bot wins!" } else { "Stalemate." });
                    break;
                }
            }
            None => {
                println!("Bot has no moves — game over.");
                break;
            }
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = args.first().map(String::as_str).unwrap_or("help");

    match cmd {
        "bestmove" => {
            let fen = args.get(1).map(String::as_str).unwrap_or(START_FEN);
            let depth = parse_flag(&args, "--depth", DEFAULT_DEPTH);
            let ms = parse_flag(&args, "--ms", DEFAULT_MS);
            cmd_bestmove(fen, depth, ms);
        }
        "play" => {
            let depth = parse_flag(&args, "--depth", DEFAULT_DEPTH);
            let ms = parse_flag(&args, "--ms", DEFAULT_MS);
            cmd_play(depth, ms);
        }
        "perft" => {
            let fen = args.get(1).map(String::as_str).unwrap_or(START_FEN);
            let d: u32 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(4);
            let b = Board::from_fen(fen).expect("bad FEN");
            let start = std::time::Instant::now();
            let nodes = perft(&b, d);
            println!("perft({}) = {} ({} ms)", d, nodes, start.elapsed().as_millis());
        }
        "eval" => {
            let fen = args.get(1).map(String::as_str).unwrap_or(START_FEN);
            let b = Board::from_fen(fen).expect("bad FEN");
            println!("{}", eval::evaluate(&b));
        }
        _ => {
            println!("chessify-bot — minimax (alpha-beta) chess engine\n");
            println!("  chessify-bot bestmove \"<FEN>\" [--depth N] [--ms T]");
            println!("  chessify-bot play [--depth N] [--ms T]");
            println!("  chessify-bot perft \"<FEN>\" <depth>");
            println!("  chessify-bot eval \"<FEN>\"");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use board::Board;

    #[test]
    fn perft_startpos() {
        // Known perft values for the initial position.
        let b = Board::start();
        assert_eq!(perft(&b, 1), 20);
        assert_eq!(perft(&b, 2), 400);
        assert_eq!(perft(&b, 3), 8_902);
        assert_eq!(perft(&b, 4), 197_281);
    }

    #[test]
    fn perft_kiwipete() {
        // Standard "Kiwipete" test position — exercises castling, EP, promotions.
        let b = Board::from_fen(
            "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
        )
        .unwrap();
        assert_eq!(perft(&b, 1), 48);
        assert_eq!(perft(&b, 2), 2_039);
        assert_eq!(perft(&b, 3), 97_862);
    }

    #[test]
    fn fen_roundtrip() {
        let fens = [
            START_FEN,
            "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
            "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
        ];
        for fen in fens {
            let b = Board::from_fen(fen).unwrap();
            assert_eq!(b.to_fen(), fen);
        }
    }

    #[test]
    fn finds_mate_in_one() {
        // Back-rank mate: Ra8#
        let b = Board::from_fen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1").unwrap();
        let r = search(&b, 4, 10_000);
        assert_eq!(r.best.unwrap().uci(), "a1a8");
        assert!(r.score >= eval::MATE - 100);
    }

    #[test]
    fn avoids_hanging_queen() {
        // White queen attacked by a pawn — engine must not leave it en prise.
        let b = Board::from_fen("rnb1kbnr/pppp1ppp/8/4p1q1/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1")
            .unwrap();
        let r = search(&b, 4, 10_000);
        // Nxg5 wins the queen (knight on f3 takes g5).
        assert_eq!(r.best.unwrap().uci(), "f3g5");
    }

    #[test]
    fn stalemate_reported() {
        // Classic stalemate: black to move, no legal moves, not in check.
        let b = Board::from_fen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").unwrap();
        assert!(legal_moves(&b).is_empty());
        assert!(!in_check(&b, b.side));
    }
}
