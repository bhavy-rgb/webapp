import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { Chessboard } from "react-chessboard";
import { ArrowCounterClockwise, ArrowLeft, ArrowRight, Robot, Flag, Lightbulb, ListNumbers, SlidersHorizontal, User, CaretRight } from "@phosphor-icons/react";
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
  const { user } = useAuth();
  const [moveInput, setMoveInput] = useState("");
  const [moveError, setMoveError] = useState("");
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
  const activeSearch = useRef<number | null>(null);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(480);
  // Engine evaluation after each position — submitted with the game so the
  // admin panel can build training sets from real play.
  const evalHistoryRef = useRef<Array<{ fen: string; evalCp: number; moveNumber: number }>>([]);
  const submittedRef = useRef(false); // guard against double submission

  useEffect(() => {
    engine.warmUp();
    return () => {
      requestSeq.current++;
      activeSearch.current = null;
      engine.dispose();
    };
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
    const seq = requestSeq.current;
    const g = gameRef.current;
    const moveNumber = g.history().length;
    engine
      .evaluate(currentFen)
      .then((cp) => {
        if (seq !== requestSeq.current || g !== gameRef.current || g.fen() !== currentFen) return;
        setEvalCp(turn === "w" ? cp : -cp);
        evalHistoryRef.current.push({
          fen: currentFen,
          evalCp: turn === "w" ? cp : -cp,
          moveNumber,
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

  const botMove = async (humanColor: PlayerColor = playerColor) => {
    const g = gameRef.current;
    if (g.isGameOver() || g.turn() === humanColor || activeSearch.current !== null) return;
    const seq = ++requestSeq.current;
    const searchFen = g.fen();
    const isCurrent = () => seq === requestSeq.current && g === gameRef.current && g.fen() === searchFen;
    activeSearch.current = seq;
    setThinking(true);
    const uciHistory = g
      .history({ verbose: true })
      .map((m) => m.from + m.to + (m.promotion ?? ""))
      .join(" ");
    try {
      const r = await engine.bestMove(searchFen, level, uciHistory);
      if (!isCurrent()) return;
      // chess.js remains authoritative even if the engine returns bad data.
      if (!r.bestmove) throw new Error("No legal bot reply returned");
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
      // Never let a cancelled search play a fallback into a reset/resigned game.
      if (!isCurrent()) return;
      const moves = g.moves({ verbose: true });
      if (moves.length > 0) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        g.move({ from: m.from, to: m.to, promotion: m.promotion });
        setEngineInfo("Engine unavailable — played a quick legal reply.");
        refresh();
      }
    } finally {
      if (activeSearch.current === seq) activeSearch.current = null;
      if (seq === requestSeq.current) setThinking(false);
    }
  };

  const hints = useMoveHints(fen);

  const onPieceDrop = (source: string, target: string): boolean => {
    hints.clear();
    if (status === "checkmate" || status === "draw" || status === "resigned") return false;
    const g = gameRef.current;
    if (g.turn() !== playerColor || thinking || activeSearch.current !== null) return false;

    try {
      const result = g.move({ from: source, to: target, promotion: "q" });
      if (!result) return false;
    } catch {
      return false;
    }

    refresh();
    if (!g.isGameOver()) {
      // Prioritize the reply; don't queue a redundant evaluation before search.
      void botMove();
    } else {
      updateEval(g.fen(), g.turn() as PlayerColor);
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
    activeSearch.current = null;
    engine.dispose(); // terminate old WASM search instead of queuing behind it
    hints.clear();
    setMoveInput("");
    setMoveError("");
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
      // Start immediately, with the new color (not a stale delayed closure).
      void botMove(color);
    }
  };

  const resign = () => {
    if (status !== "playing" && status !== "check") return;
    requestSeq.current++;
    activeSearch.current = null;
    engine.dispose();
    hints.clear();
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

  const ended = status === "checkmate" || status === "draw" || status === "resigned";
  const turnLabel = ended ? statusLabels[status].text : thinking ? "Bot is thinking…" : status === "check" ? "You are in check" : "Your move";

  return <div className="bot-page">
    <Navbar />
    <main id="main-content" tabIndex={-1} className="page-width bot-main">
      <ScrollReveal className="bot-heading"><div><Link to="/lobby" className="bot-breadcrumb"><ArrowLeft size={14} /> Lobby <CaretRight size={12} /><span>Bot match</span></Link><h1 className="hero-heading">Your board. Your pace.</h1><p>A little challenge, without the pressure. Make your next move.</p></div><span className="practice-badge"><span className="status-dot" /> Practice mode</span></ScrollReveal>
      <div className="bot-workspace">
        {/* A filtered/transformed ancestor offsets react-chessboard's fixed drag layer. */}
        <div className="game-column">
          <div className="game-player"><span className="player-avatar bot-avatar"><Robot size={24} /></span><div><h2>Chessify bot <span>{LEVELS[level].name}</span></h2><p>{thinking ? "Finding the next move…" : "Ready for a little friendly competition"}</p></div><span className="player-color">{playerColor === "w" ? "Black" : "White"}</span></div>
          <div className="game-board-frame">
            <div ref={boardWrapRef} className="game-board" aria-label="Chess board. Drag a piece to move, or use keyboard move entry below.">
              <Chessboard
                position={fen}
                onPieceDrop={onPieceDrop}
                onPieceDragBegin={hints.onPieceDragBegin}
                onPieceDragEnd={hints.onPieceDragEnd}
                customSquareStyles={hints.customSquareStyles}
                boardOrientation={playerColor === "w" ? "white" : "black"}
                areArrowsAllowed={false}
                arePiecesDraggable={!ended && !thinking && gameRef.current.turn() === playerColor}
                isDraggablePiece={({ piece }) => piece[0] === playerColor}
                autoPromoteToQueen
                boardWidth={Math.min(boardWidth, 620)}
                animationDuration={180}
                customDarkSquareStyle={{ backgroundColor: "#899b73" }}
                customLightSquareStyle={{ backgroundColor: "#eeefe5" }}
                customBoardStyle={{ borderRadius: "8px", overflow: "hidden" }}
              />
            </div>
          </div>
          <div className="game-player"><span className="player-avatar"><User size={24} /></span><div><h2>{user?.username ?? "You"}<span>{user ? "Player" : "Guest"}</span></h2><p>{playerColor === "w" ? "Playing with the white pieces" : "Playing with the black pieces"}</p></div><span className="turn-indicator" role="status">{turnLabel}</span></div>
          <div className="game-bottom"><p>Drag a piece to see its legal moves.</p><span>Powered by the Chessify engine</span></div>
          <details className="keyboard-moves"><summary>Keyboard move entry</summary><form onSubmit={event => {
            event.preventDefault();
            const move = gameRef.current.moves({ verbose: true }).find(m => m.san.toLowerCase() === moveInput.trim().toLowerCase() || m.from + m.to === moveInput.trim().toLowerCase());
            if (move && onPieceDrop(move.from, move.to)) { setMoveInput(""); setMoveError(""); }
            else setMoveError("That move is not available. Check the notation and whose turn it is.");
          }}><label htmlFor="keyboard-move">Enter a move, such as e4 or e2e4</label><div className="flex gap-2"><input id="keyboard-move" value={moveInput} onChange={event => setMoveInput(event.target.value)} aria-describedby={moveError ? "move-error" : undefined} aria-invalid={!!moveError} disabled={thinking || ended} autoComplete="off" /><button className="btn-secondary" disabled={thinking || ended || !moveInput.trim()}>Make move</button></div>{moveError && <p id="move-error" className="field-error" role="alert">{moveError}</p>}</form></details>
        </div>
        <ScrollReveal delay={.1}><aside className="game-sidebar" aria-label="Game settings and moves">
          <section className="game-panel"><h2><SlidersHorizontal size={18} /> Your game <span>No timer</span></h2><fieldset><legend>Choose your challenge</legend><div className="difficulty-options">{LEVELS.map(l => <button key={l.id} onClick={() => setLevel(l.id)} aria-pressed={level === l.id}><span className="difficulty-bars" aria-hidden="true">{[0, 1, 2, 3, 4].map(bar => <span key={bar} className={bar <= l.id ? "filled" : ""} style={{ height: `${8 + bar * 2}px` }} />)}</span>{l.name}</button>)}</div><p className="setting-hint">{LEVELS[level].blurb.replace("A-game", "best game")}</p></fieldset><fieldset><legend>Your side of the board</legend><div className="color-options"><button onClick={() => startNewGame("w")} aria-pressed={playerColor === "w"}><span aria-hidden="true">♔</span> White</button><button onClick={() => startNewGame("b")} aria-pressed={playerColor === "b"}><span aria-hidden="true">♚</span> Black</button></div><p className="setting-hint">Changing color starts a new game.</p></fieldset><div className="game-actions"><button onClick={() => startNewGame()} className="btn-primary"><ArrowCounterClockwise size={16} /> New game</button><button onClick={resign} disabled={ended} className="btn-secondary"><Flag size={16} /> Resign</button></div></section>
          <section className="game-panel history-panel"><h2><ListNumbers size={18} /> Move history <span>{history.length} moves</span></h2>
            {history.length === 0 ? <div className="history-empty"><span aria-hidden="true">♙</span><h3>Every game starts somewhere.</h3><p>{playerColor === "w" ? "Make your first move. The story of your game will appear here." : "The bot will open the game. Your moves will appear here."}</p></div> : <div className="move-table-wrap"><table className="move-table"><thead><tr><th scope="col">Move</th><th scope="col">White</th><th scope="col">Black</th></tr></thead><tbody>{Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => <tr key={i}><th scope="row">{i + 1}.</th><td className={i * 2 === history.length - 1 ? "latest-move" : ""}>{history[i * 2]}</td><td className={i * 2 + 1 === history.length - 1 ? "latest-move" : ""}>{history[i * 2 + 1] ?? "…"}</td></tr>)}</tbody></table></div>}
            {thinking && <div className="engine-loading" role="status"><div className="skeleton-block h-4 w-24" /><div className="skeleton-block h-4 w-16" /><span>Thinking…</span></div>}
            {lastMove && !thinking && <p className="last-move">Last move: <strong>{lastMove}</strong></p>}
            {engineInfo && !thinking && <p className="engine-info">{engineInfo}</p>}
          </section>
          <section className="game-panel evaluation-panel"><h2>Board balance <span aria-label={`White evaluation ${evalLabel}`}>{evalLabel}</span></h2><div className="evaluation-track" role="img" aria-label={`Position evaluation: ${evalLabel} pawns for White`}><div style={{ width: `${whitePct}%` }} /></div><div className="evaluation-labels"><span>White</span><span>Black</span></div></section>
          <div className="practice-tip"><Lightbulb size={20} /><div><h2>A little tip</h2><p>Try bringing your knights and bishops into play before moving your queen.</p><Link className="text-link" to="/training">Meet the pieces <ArrowRight size={14} /></Link></div></div>
        </aside></ScrollReveal>
      </div>
    </main>
    <Footer />
  </div>;
}
