import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { RotateCcw, Cpu, Flag } from "lucide-react";
import Navbar from "@/components/Navbar";
import { ScrollReveal } from "@/components/ScrollReveal";
import { engine, LEVELS, type LevelId } from "@/engine";
import { botGamesApi, getGuestId } from "@/api";
import { useMoveHints } from "@/hooks/useMoveHints";

type Status = "playing" | "check" | "checkmate" | "draw" | "resigned";
type PlayerColor = "w" | "b";

const statusLabels: Record<Status, { text: string; className: string }> = {
  playing: { text: "Game on", className: "bg-forest/10 text-forest" },
  check: { text: "Check!", className: "bg-capture/10 text-capture" },
  checkmate: { text: "Checkmate — game over", className: "bg-forest-deep text-cream" },
  draw: { text: "Draw — game over", className: "bg-parchment text-ink-soft" },
  resigned: { text: "You resigned", className: "bg-parchment text-ink-soft" },
};

export default function Bot() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("playing");
  const [thinking, setThinking] = useState(false);
  const [level, setLevel] = useState<LevelId>(2);
  const [playerColor, setPlayerColor] = useState<PlayerColor>("w");
  const [evalCp, setEvalCp] = useState(0); // centipawns, white perspective
  const [engineInfo, setEngineInfo] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(480);
  // Engine evaluation after each position — submitted with the game so the
  // admin panel can build training sets from real play.
  const evalHistoryRef = useRef<Array<{ fen: string; evalCp: number; moveNumber: number }>>([]);
  const submittedRef = useRef(false); // guard against double submission

  useEffect(() => {
    engine.warmUp();
  }, []);

  const refresh = () => {
    const g = gameRef.current;
    setFen(g.fen());
    setHistory(g.history());
    if (g.isCheckmate()) setStatus("checkmate");
    else if (g.isDraw() || g.isStalemate() || g.isThreefoldRepetition()) setStatus("draw");
    else if (g.isCheck()) setStatus("check");
    else setStatus("playing");
    // Game just ended on the board → record it for the admin panel.
    if (g.isCheckmate() || g.isDraw() || g.isStalemate() || g.isThreefoldRepetition()) {
      void submitGameToServer();
    }
  };

  const updateEval = (currentFen: string, turn: PlayerColor) => {
    engine
      .evaluate(currentFen)
      .then((cp) => {
        setEvalCp(turn === "w" ? cp : -cp);
        evalHistoryRef.current.push({
          fen: currentFen,
          evalCp: turn === "w" ? cp : -cp,
          moveNumber: gameRef.current.history().length,
        });
      })
      .catch(() => {});
  };

  async function submitGameToServer(overrideResult?: string) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    try {
      const g = gameRef.current;
      const verboseMoves = g.history({ verbose: true });
      const moves = verboseMoves.map((m) => ({
        from: m.from,
        to: m.to,
        san: m.san,
        promotion: m.promotion ?? null,
      }));
      const finalFen = g.fen();

      let result = overrideResult ?? "abandoned";
      if (!overrideResult) {
        if (g.isCheckmate()) {
          // Side to move is checkmated → the other side wins.
          const winner = g.turn() === "w" ? "b" : "w";
          result = `checkmate:${winner}`;
        } else if (g.isStalemate()) {
          result = "draw:stalemate";
        } else if (g.isInsufficientMaterial()) {
          result = "draw:insufficient";
        } else if (g.isThreefoldRepetition()) {
          result = "draw:repetition";
        } else if (g.isDraw()) {
          result = "draw:fifty-move";
        }
      }

      await botGamesApi.submit({
        playerColor,
        difficultyLevel: level,
        moves,
        finalFen,
        result,
        evalHistory: evalHistoryRef.current,
      });
    } catch (err) {
      console.error("Failed to submit bot game:", err);
    }
  }

  const botMove = async () => {
    const g = gameRef.current;
    if (g.isGameOver()) return;
    const seq = ++requestSeq.current;
    setThinking(true);
    const uciHistory = g
      .history({ verbose: true })
      .map((m) => m.from + m.to + (m.promotion ?? ""))
      .join(" ");
    try {
      const r = await engine.bestMove(g.fen(), level, uciHistory);
      if (seq !== requestSeq.current) return; // stale (game was reset)
      if (r.bestmove) {
        g.move({
          from: r.bestmove.slice(0, 2),
          to: r.bestmove.slice(2, 4),
          promotion: r.bestmove.length > 4 ? r.bestmove[4] : undefined,
        });
        if (r.depth !== undefined && r.nodes !== undefined && r.depth > 0) {
          setEngineInfo(`depth ${r.depth} · ${r.nodes.toLocaleString()} nodes`);
        } else {
          setEngineInfo(null);
        }
        refresh();
        updateEval(g.fen(), g.turn() as PlayerColor);
      }
    } catch {
      // Engine failed (no WASM support?) — random fallback keeps game playable.
      const moves = g.moves({ verbose: true });
      if (moves.length > 0) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        g.move({ from: m.from, to: m.to, promotion: "q" });
        refresh();
      }
    } finally {
      if (seq === requestSeq.current) setThinking(false);
    }
  };

  const hints = useMoveHints(fen);

  const onPieceDrop = (source: string, target: string): boolean => {
    hints.clear();
    if (status === "checkmate" || status === "draw" || status === "resigned") return false;
    const g = gameRef.current;
    if (g.turn() !== playerColor || thinking) return false;

    try {
      const result = g.move({ from: source, to: target, promotion: "q" });
      if (!result) return false;
    } catch {
      return false;
    }

    refresh();
    updateEval(g.fen(), g.turn() as PlayerColor);
    if (!gameRef.current.isGameOver()) {
      void botMove();
    }
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

  const startNewGame = (color: PlayerColor = playerColor) => {
    requestSeq.current++;
    gameRef.current = new Chess();
    evalHistoryRef.current = [];
    submittedRef.current = false;
    setHistory([]);
    setThinking(false);
    setEvalCp(0);
    setEngineInfo(null);
    setPlayerColor(color);
    setStatus("playing");
    setFen(gameRef.current.fen());
    if (color === "b") {
      // Bot opens as White.
      setTimeout(() => void botMove(), 250);
    }
  };

  const resign = () => {
    if (status !== "playing" && status !== "check") return;
    requestSeq.current++;
    setThinking(false);
    setStatus("resigned");
    // The bot wins when you resign.
    void submitGameToServer(`resign:${playerColor === "w" ? "b" : "w"}`);
  };

  // Record abandoned games on tab close — sendBeacon survives page unload.
  useEffect(() => {
    const handler = () => {
      const g = gameRef.current;
      if (g.history().length > 0 && !g.isGameOver() && !submittedRef.current) {
        const moves = g
          .history({ verbose: true })
          .map((m) => ({ from: m.from, to: m.to, san: m.san, promotion: m.promotion ?? null }));
        // sendBeacon can't set headers — the guest id rides a query param
        // (the auth cookie is attached automatically for signed-in users).
        navigator.sendBeacon(
          `/api/bot-games?guest=${encodeURIComponent(getGuestId())}`,
          JSON.stringify({
            playerColor,
            difficultyLevel: level,
            moves,
            finalFen: g.fen(),
            result: "abandoned",
            evalHistory: evalHistoryRef.current,
          })
        );
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [playerColor, level]);

  const lastMove = history[history.length - 1];

  // Eval bar: map centipawns → 0..100% white share (sigmoid-ish clamp).
  const whitePct = Math.max(4, Math.min(96, 50 + (evalCp / 20)));
  const evalLabel =
    Math.abs(evalCp) >= 9000
      ? evalCp > 0
        ? "M+"
        : "M-"
      : `${evalCp >= 0 ? "+" : ""}${(evalCp / 100).toFixed(1)}`;

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
            A real chess engine — alpha-beta search with a transposition table,
            written in Rust and compiled to WebAssembly. Pick a difficulty and play.
          </p>
        </ScrollReveal>

        <div className="mx-auto grid max-w-4xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Board */}
          <ScrollReveal>
            <div className="rounded-3xl border border-parchment bg-white p-4 shadow-[0_20px_60px_-20px_rgba(38,35,30,0.2)]">
              {/* Eval bar */}
              <div className="mb-3 flex items-center gap-2 px-1">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/80">
                  <div
                    className="h-full rounded-full bg-cream transition-all duration-500"
                    style={{ width: `${whitePct}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-xs font-semibold text-ink-soft">
                  {evalLabel}
                </span>
              </div>

              <div className="w-full" ref={boardWrapRef}>
                <Chessboard
                  position={fen}
                  onPieceDrop={onPieceDrop}
                  onPieceDragBegin={hints.onPieceDragBegin}
                  onPieceDragEnd={hints.onPieceDragEnd}
                  customSquareStyles={hints.customSquareStyles}
                  boardOrientation={playerColor === "w" ? "white" : "black"}
                  areArrowsAllowed={false}
                  boardWidth={Math.min(boardWidth, 620)}
                  animationDuration={180}
                  customDarkSquareStyle={{ backgroundColor: "#b58863" }}
                  customLightSquareStyle={{ backgroundColor: "#f0e7d3" }}
                  customBoardStyle={{ borderRadius: "12px", overflow: "hidden" }}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1">
                <span
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${statusLabels[status].className}`}
                >
                  {status === "playing"
                    ? gameRef.current.turn() === playerColor
                      ? "Your move"
                      : "Bot to move"
                    : statusLabels[status].text}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={resign}
                    className="inline-flex items-center gap-1.5 rounded-full border border-parchment px-4 py-2 text-xs font-semibold text-ink-soft transition-all hover:border-capture/40 hover:text-capture"
                  >
                    <Flag size={14} /> Resign
                  </button>
                  <button
                    onClick={() => startNewGame()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-parchment px-4 py-2 text-xs font-semibold text-ink-soft transition-all hover:border-terracotta/40 hover:text-terracotta"
                  >
                    <RotateCcw size={14} /> New game
                  </button>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Sidebar */}
          <ScrollReveal delay={0.15} direction="right">
            <div className="flex flex-col gap-5">
              {/* Difficulty */}
              <div className="rounded-2xl border border-parchment bg-white p-5">
                <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                  <Cpu size={14} /> Difficulty
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {LEVELS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLevel(l.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                        level === l.id
                          ? "bg-forest text-cream"
                          : "border border-parchment text-ink-soft hover:border-forest/40 hover:text-forest"
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-xs text-ink-soft/80">{LEVELS[level].blurb}</p>

                <h2 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                  Play as
                </h2>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => startNewGame("w")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                      playerColor === "w"
                        ? "bg-ink text-cream"
                        : "border border-parchment text-ink-soft hover:border-ink/40"
                    }`}
                  >
                    ♔ White
                  </button>
                  <button
                    onClick={() => startNewGame("b")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                      playerColor === "b"
                        ? "bg-ink text-cream"
                        : "border border-parchment text-ink-soft hover:border-ink/40"
                    }`}
                  >
                    ♚ Black
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-ink-soft/60">
                  Changing color starts a new game.
                </p>
              </div>

              {/* Move history */}
              <div className="rounded-2xl border border-parchment bg-white p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                  Move history
                </h2>
                {history.length === 0 ? (
                  <p className="text-sm text-ink-soft/70">
                    No moves yet.{" "}
                    {playerColor === "w" ? "It's your turn!" : "Bot opens the game."}
                  </p>
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
                    Engine is thinking…
                  </p>
                )}
                {engineInfo && !thinking && (
                  <p className="mt-3 font-mono text-[11px] text-ink-soft/60">
                    last search: {engineInfo}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-forest/15 bg-forest/5 p-5 text-sm leading-relaxed text-ink-soft">
                <p className="mb-2 font-semibold text-forest">Under the hood</p>
                <ul className="list-inside list-disc space-y-1.5 text-[13px]">
                  <li>Rust engine compiled to WebAssembly, running in a Web Worker.</li>
                  <li>Negamax + alpha-beta, transposition table, quiescence search.</li>
                  <li>Lower levels mix in casual moves so games stay winnable.</li>
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
