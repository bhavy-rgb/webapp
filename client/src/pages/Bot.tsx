import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { RotateCcw } from "lucide-react";
import Navbar from "@/components/Navbar";
import { ScrollReveal } from "@/components/ScrollReveal";

type Status = "playing" | "check" | "checkmate" | "draw";

const statusLabels: Record<Status, { text: string; className: string }> = {
  playing: { text: "Your move — play as White", className: "bg-forest/10 text-forest" },
  check: { text: "Check!", className: "bg-capture/10 text-capture" },
  checkmate: { text: "Checkmate — game over", className: "bg-forest-deep text-cream" },
  draw: { text: "Draw — game over", className: "bg-parchment text-ink-soft" },
};

export default function Bot() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("playing");
  const [thinking, setThinking] = useState(false);
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(480);

  const refresh = () => {
    const g = gameRef.current;
    setFen(g.fen());
    setHistory(g.history());
    if (g.isCheckmate()) setStatus("checkmate");
    else if (g.isDraw() || g.isStalemate() || g.isThreefoldRepetition()) setStatus("draw");
    else if (g.isCheck()) setStatus("check");
    else setStatus("playing");
  };

  const botMove = () => {
    const g = gameRef.current;
    if (g.isGameOver()) return;
    const moves = g.moves({ verbose: true });
    if (moves.length === 0) return;
    const move = moves[Math.floor(Math.random() * moves.length)];
    g.move({ from: move.from, to: move.to, promotion: "q" });
    refresh();
  };

  const onPieceDrop = (source: string, target: string): boolean => {
    if (status === "checkmate" || status === "draw") return false;
    const g = gameRef.current;
    if (g.turn() !== "w") return false;

    try {
      const result = g.move({
        from: source,
        to: target,
        promotion: "q",
      });
      if (!result) return false;
    } catch {
      return false;
    }

    refresh();
    if (gameRef.current.isGameOver()) {
      return true;
    }
    setThinking(true);
    botTimer.current = setTimeout(() => {
      botMove();
      setThinking(false);
    }, 450);
    return true;
  };

  useLayoutEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const update = () => setBoardWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (botTimer.current) clearTimeout(botTimer.current);
    };
  }, []);

  const reset = () => {
    if (botTimer.current) clearTimeout(botTimer.current);
    gameRef.current = new Chess();
    setHistory([]);
    setThinking(false);
    refresh();
  };

  const lastMove = history[history.length - 1];

  return (
    <div className="grain min-h-screen bg-cream">
      <Navbar />

      <section className="mx-auto max-w-6xl px-5 pt-28">
        <ScrollReveal className="mx-auto mb-10 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            Bot match
          </span>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            You vs. the machine
          </h1>
          <p className="mt-4 text-ink-soft">
            Play as White. Every move is validated for legality — if a knight can't
            go there, the board won't let you. The bot replies after a moment.
          </p>
        </ScrollReveal>

        <div className="mx-auto grid max-w-4xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Board */}
          <ScrollReveal>
            <div className="rounded-3xl border border-parchment bg-white p-4 shadow-[0_20px_60px_-20px_rgba(38,35,30,0.2)]">
              <div className="w-full" ref={boardWrapRef}>
                <Chessboard
                  position={fen}
                  onPieceDrop={onPieceDrop}
                  boardOrientation="white"
                  areArrowsAllowed={false}
                  boardWidth={Math.min(boardWidth, 620)}
                  animationDuration={180}
                  customDarkSquareStyle={{ backgroundColor: "#b58863" }}
                  customLightSquareStyle={{ backgroundColor: "#f0e7d3" }}
                  customBoardStyle={{ borderRadius: "12px", overflow: "hidden" }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between px-1">
                <span
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${statusLabels[status].className}`}
                >
                  {statusLabels[status].text}
                </span>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 rounded-full border border-parchment px-4 py-2 text-xs font-semibold text-ink-soft transition-all hover:border-terracotta/40 hover:text-terracotta"
                >
                  <RotateCcw size={14} /> New game
                </button>
              </div>
            </div>
          </ScrollReveal>

          {/* Sidebar */}
          <ScrollReveal delay={0.15} direction="right">
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-parchment bg-white p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                  Move history
                </h2>
                {history.length === 0 ? (
                  <p className="text-sm text-ink-soft/70">No moves yet. It's your turn!</p>
                ) : (
                  <ol className="grid max-h-48 grid-cols-[auto_1fr] gap-x-3 gap-y-1 overflow-y-auto pr-1 text-sm">
                    {history.map((move, i) => (
                      <li
                        key={i}
                        className={`contents ${i === history.length - 1 ? "font-semibold text-forest" : "text-ink-soft"}`}
                      >
                        <span className="text-ink-soft/60">{Math.floor(i / 2) + 1}.</span>
                        <span>
                          {move}
                          {i === history.length - 1 ? " ←" : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                {thinking && (
                  <p className="mt-3 animate-pulse text-xs font-semibold text-terracotta">
                    Bot is thinking…
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-forest/15 bg-forest/5 p-5 text-sm leading-relaxed text-ink-soft">
                <p className="mb-2 font-semibold text-forest">Tips</p>
                <ul className="list-inside list-disc space-y-1.5 text-[13px]">
                  <li>Drag a piece to the square you want.</li>
                  <li>Pawns promote to queens automatically on the last rank.</li>
                  <li>Wrong moves simply snap back — nothing is illegal here.</li>
                </ul>
              </div>

              {lastMove && (
                <p className="text-center text-xs text-ink-soft/70">
                  Last move: <span className="font-semibold text-ink">{lastMove}</span>
                </p>
              )}
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
