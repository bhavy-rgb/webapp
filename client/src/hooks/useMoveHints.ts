import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";

/**
 * Board move hints: while a piece is being dragged, highlight its source
 * square and every legal destination (dot for quiet moves, ring for captures).
 *
 * Usage:
 *   const hints = useMoveHints(fen);
 *   <Chessboard
 *     onPieceDragBegin={hints.onPieceDragBegin}
 *     onPieceDragEnd={hints.onPieceDragEnd}
 *     customSquareStyles={hints.customSquareStyles}
 *   />
 * Call hints.clear() inside onPieceDrop so the dots vanish on drop.
 */
export function useMoveHints(fen: string) {
  const [dragFrom, setDragFrom] = useState<Square | null>(null);

  useEffect(() => setDragFrom(null), [fen]);

  const onPieceDragBegin = useCallback((_piece: string, sourceSquare: Square) => {
    setDragFrom(sourceSquare);
  }, []);

  const clear = useCallback(() => setDragFrom(null), []);

  // Tap a piece, then a legal destination: also works with touch screens.
  const onSquareClick = (square: Square, move: (from: string, to: string) => boolean) => {
    if (dragFrom && dragFrom !== square && move(dragFrom, square)) {
      clear();
      return;
    }
    const game = new Chess(fen);
    const piece = game.get(square);
    setDragFrom(piece?.color === game.turn() && square !== dragFrom ? square : null);
  };

  const customSquareStyles = useMemo(() => {
    if (!dragFrom) return {};
    let moves: ReturnType<Chess["moves"]>;
    try {
      moves = new Chess(fen).moves({ square: dragFrom, verbose: true });
    } catch {
      return {};
    }
    const styles: Record<string, CSSProperties> = {
      // Source square — soft gold wash
      [dragFrom]: { backgroundColor: "rgba(198, 161, 91, 0.40)" },
    };
    for (const m of moves as { to: string; captured?: string; flags: string }[]) {
      styles[m.to] =
        m.captured || m.flags.includes("e")
          ? {
              // Capture — terracotta ring around the edge of the square
              background:
                "radial-gradient(circle, transparent 56%, rgba(193, 102, 74, 0.55) 60%)",
            }
          : {
              // Quiet move — forest dot in the centre
              background:
                "radial-gradient(circle, rgba(35, 70, 58, 0.30) 24%, transparent 27%)",
            };
    }
    return styles;
  }, [dragFrom, fen]);

  return { onSquareClick, onPieceDragBegin, onPieceDragEnd: clear, customSquareStyles, clear };
}
