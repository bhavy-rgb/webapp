/**
 * Chess piece definitions for the piece-card gallery.
 *
 * Movement rules are per *type*, so we show 6 cards (Pawn, Knight, Bishop,
 * Rook, Queen, King) rather than all 32 individual pieces — a pawn on e2 moves
 * exactly like a pawn on a7. Each card renders a mini 8×8 diagram computed
 * from the `moves` spec below.
 */

export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

export interface MoveSpec {
  dx: number;
  dy: number;
  slide?: boolean; // ray continues until edge of board
  capture?: boolean; // shown in capture color (pawn diagonal)
  twoStep?: boolean; // pawn's double-step from starting rank
}

export interface PieceDef {
  type: PieceType;
  name: string;
  glyph: string;
  tagline: string;
  description: string;
  center: { file: number; rank: number };
  moves: MoveSpec[];
  accent: string;
}

export type SquareKind = "move" | "capture" | "two-step";

export interface ReachableSquare {
  file: number;
  rank: number;
  kind: SquareKind;
}

/** Compute all squares a piece can reach from its diagram center. */
export function reachableSquares(piece: PieceDef): ReachableSquare[] {
  const out: ReachableSquare[] = [];
  const { file, rank } = piece.center;

  for (const m of piece.moves) {
    const kind: SquareKind = m.capture
      ? "capture"
      : m.twoStep
        ? "two-step"
        : "move";

    if (m.slide) {
      let f = file + m.dx;
      let r = rank + m.dy;
      while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
        out.push({ file: f, rank: r, kind });
        f += m.dx;
        r += m.dy;
      }
    } else {
      const f = file + m.dx;
      const r = rank + m.dy;
      if (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
        out.push({ file: f, rank: r, kind });
      }
    }
  }
  return out;
}

export const PIECES: PieceDef[] = [
  {
    type: "pawn",
    name: "Pawn",
    glyph: "♟",
    tagline: "Moves forward one, captures diagonally.",
    description:
      "Pawns are the foot soldiers. They advance one square at a time (two from their starting rank) and capture one square diagonally ahead. Reach the far side and they promote — often into a queen.",
    center: { file: 3, rank: 1 }, // d2 — near its start, forward = up
    moves: [
      { dx: 0, dy: 1 },
      { dx: 0, dy: 2, twoStep: true },
      { dx: -1, dy: 1, capture: true },
      { dx: 1, dy: 1, capture: true },
    ],
    accent: "#c4664a",
  },
  {
    type: "knight",
    name: "Knight",
    glyph: "♞",
    tagline: "Jumps in an L-shape, past any piece.",
    description:
      "The only piece that can leap over others. Knights move two squares one way and one square perpendicular — eight possible L-shapes from the center of the board.",
    center: { file: 3, rank: 3 }, // d4
    moves: [
      { dx: -2, dy: -1 },
      { dx: -2, dy: 1 },
      { dx: -1, dy: -2 },
      { dx: -1, dy: 2 },
      { dx: 1, dy: -2 },
      { dx: 1, dy: 2 },
      { dx: 2, dy: -1 },
      { dx: 2, dy: 1 },
    ],
    accent: "#2f5d4a",
  },
  {
    type: "bishop",
    name: "Bishop",
    glyph: "♝",
    tagline: "Slides diagonally, any distance.",
    description:
      "Bishops keep to the color they start on, gliding along diagonals as far as the board allows. That's why each side has two — one for each square color.",
    center: { file: 3, rank: 3 },
    moves: [
      { dx: -1, dy: -1, slide: true },
      { dx: -1, dy: 1, slide: true },
      { dx: 1, dy: -1, slide: true },
      { dx: 1, dy: 1, slide: true },
    ],
    accent: "#2f5d4a",
  },
  {
    type: "rook",
    name: "Rook",
    glyph: "♜",
    tagline: "Slides horizontally or vertically.",
    description:
      "The rook owns the open files and ranks. It moves any distance along rows and columns, and teams up with the king to castle — the only move that touches two of your own pieces at once.",
    center: { file: 3, rank: 3 },
    moves: [
      { dx: 0, dy: -1, slide: true },
      { dx: 0, dy: 1, slide: true },
      { dx: -1, dy: 0, slide: true },
      { dx: 1, dy: 0, slide: true },
    ],
    accent: "#2f5d4a",
  },
  {
    type: "queen",
    name: "Queen",
    glyph: "♛",
    tagline: "Slides any direction, any distance.",
    description:
      "The most powerful piece combines rook and bishop moves — straight and diagonal, as far as the board allows. Protect her, because the whole game can revolve around her.",
    center: { file: 3, rank: 3 },
    moves: [
      { dx: 0, dy: -1, slide: true },
      { dx: 0, dy: 1, slide: true },
      { dx: -1, dy: 0, slide: true },
      { dx: 1, dy: 0, slide: true },
      { dx: -1, dy: -1, slide: true },
      { dx: -1, dy: 1, slide: true },
      { dx: 1, dy: -1, slide: true },
      { dx: 1, dy: 1, slide: true },
    ],
    accent: "#d9a441",
  },
  {
    type: "king",
    name: "King",
    glyph: "♚",
    tagline: "One square in any direction.",
    description:
      "Slow but priceless — the king steps one square any way. You can never leave your king in check, and when it's trapped, the game is over. Castle to safety in the opening.",
    center: { file: 3, rank: 3 },
    moves: [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: 1, dy: 1 },
    ],
    accent: "#c4664a",
  },
];
