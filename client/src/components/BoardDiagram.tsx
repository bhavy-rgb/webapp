import { reachableSquares, type PieceDef } from "@/lib/pieces";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

/**
 * Mini 8×8 board diagram for a single piece: highlighted squares + arrows
 * showing legal move directions from the piece's center square.
 */
export function BoardDiagram({ piece }: { piece: PieceDef }) {
  const squares = reachableSquares(piece);
  const { file: cx, rank: cr } = piece.center;

  const colorFor = (kind: string) =>
    kind === "capture" ? "#c4452f" : kind === "two-step" ? "#d9a441" : "#1f6f52";

  const squareFor = (file: number, rank: number) => ({
    x: file,
    y: 7 - rank, // rank 1 at the bottom
  });

  const center = squareFor(cx, cr);

  // For sliding rays we draw one arrow to the outermost square of the ray
  // (keeps the diagram clean); non-sliding moves each get their own arrow.
  const isSlidingDir = (sf: number, sr: number) =>
    piece.moves.some(
      (m) =>
        m.slide === true &&
        Math.sign(m.dx) === Math.sign(sf - cx) &&
        Math.sign(m.dy) === Math.sign(sr - cr)
    );

  const arrowTargets = squares.filter((s) => {
    if (!isSlidingDir(s.file, s.rank)) return true;
    // outermost square along this direction: no further square in the same
    // direction is reachable
    return !squares.some(
      (o) =>
        o !== s &&
        Math.sign(o.file - cx) === Math.sign(s.file - cx) &&
        Math.sign(o.rank - cr) === Math.sign(s.rank - cr) &&
        (Math.abs(o.file - cx) > Math.abs(s.file - cx) ||
          Math.abs(o.rank - cr) > Math.abs(s.rank - cr))
    );
  });

  return (
    <div className="w-full">
      <svg viewBox="0 0 8 8" className="w-full rounded-lg" role="img" aria-label={`${piece.name} movement diagram`}>
        <defs>
          <marker
            id={`arrow-${piece.type}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="2.6"
            markerHeight="2.6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill={piece.accent} />
          </marker>
        </defs>

        {/* Board squares */}
        {Array.from({ length: 64 }).map((_, i) => {
          const file = i % 8;
          const rank = Math.floor(i / 8);
          const dark = (file + rank) % 2 === 1;
          const pos = squareFor(file, rank);
          return (
            <rect
              key={i}
              x={pos.x}
              y={pos.y}
              width={1}
              height={1}
              className={dark ? "board-dark" : "board-light"}
              rx={0.08}
            />
          );
        })}

        {/* Highlighted reachable squares */}
        {squares.map((s) => {
          const pos = squareFor(s.file, s.rank);
          return (
            <rect
              key={`${s.file}-${s.rank}`}
              x={pos.x + 0.12}
              y={pos.y + 0.12}
              width={0.76}
              height={0.76}
              rx={0.16}
              fill={colorFor(s.kind)}
              opacity={0.35}
            />
          );
        })}

        {/* Center square ring */}
        <rect
          x={center.x + 0.06}
          y={center.y + 0.06}
          width={0.88}
          height={0.88}
          rx={0.14}
          fill="none"
          stroke="#26231e"
          strokeWidth={0.06}
          opacity={0.5}
        />

        {/* Arrows */}
        {arrowTargets.map((s) => {
          const target = squareFor(s.file, s.rank);
          const x1 = center.x + 0.5;
          const y1 = center.y + 0.5;
          const x2 = target.x + 0.5;
          const y2 = target.y + 0.5;
          // shorten so arrowhead doesn't overlap the target square edge
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const sx = x2 - (dx / len) * 0.28;
          const sy = y2 - (dy / len) * 0.28;
          const dash = s.kind === "two-step" ? "0.14 0.1" : undefined;
          return (
            <line
              key={`${s.file}-${s.rank}`}
              x1={x1}
              y1={y1}
              x2={sx}
              y2={sy}
              stroke={piece.accent}
              strokeWidth={0.12}
              strokeLinecap="round"
              strokeDasharray={dash}
              markerEnd={`url(#arrow-${piece.type})`}
            />
          );
        })}

        {/* Piece glyph */}
        <text
          x={center.x + 0.5}
          y={center.y + 0.62}
          textAnchor="middle"
          fontSize={0.62}
          fill="#26231e"
          fontFamily="Segoe UI Symbol, 'DejaVu Sans', sans-serif"
        >
          {piece.glyph}
        </text>
      </svg>

      {/* Coordinates + legend */}
      <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-ink-soft">
        <div className="flex gap-1.5">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-arrow" /> move
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-capture" /> capture
          </span>
          {piece.moves.some((m) => m.twoStep) && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gold" /> two-step
            </span>
          )}
        </div>
        <span className="text-[9px] text-ink-soft/70">
          {FILES[cx]}
          {cr + 1}
        </span>
      </div>
    </div>
  );
}
