import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Check, Copy, Flag, Handshake, Hourglass } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PlaySkeleton } from "@/components/Skeleton";
import { ApiError, gamesApi, type GameState } from "@/api";
import { useAuth } from "@/context/AuthContext";
import { useMoveHints } from "@/hooks/useMoveHints";

/** Polling cadence used only when the SSE channel is unavailable. */
const FALLBACK_POLL_MS = 3000;

function fmtClock(ms: number | null): string {
  if (ms === null) return "--:--";
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function resultText(result: string | null, yourColor: "w" | "b" | null): string {
  if (!result) return "";
  const [kind, arg] = result.split(":");
  const winner = arg === "w" ? "White" : "Black";
  const youWon = yourColor && arg === yourColor;
  const suffix = yourColor ? (youWon ? " — you win! 🎉" : " — you lose") : "";
  switch (kind) {
    case "checkmate":
      return `Checkmate — ${winner} wins${suffix}`;
    case "resign":
      return `Resignation — ${winner} wins${suffix}`;
    case "timeout":
      return `Flag fell — ${winner} wins on time${suffix}`;
    case "draw":
      return arg === "agreement"
        ? "Draw by agreement"
        : arg === "stalemate"
          ? "Draw — stalemate"
          : arg === "insufficient"
            ? "Draw — insufficient material"
            : arg === "repetition"
              ? "Draw — threefold repetition"
              : "Draw — fifty-move rule";
    default:
      return result;
  }
}

export default function Play() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [game, setGame] = useState<GameState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spectating, setSpectating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyInputRef = useRef<HTMLInputElement>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [drawOffered, setDrawOffered] = useState(false);
  const [clocks, setClocks] = useState<{ w: number | null; b: number | null }>({
    w: null,
    b: null,
  });

  const gameRef = useRef<GameState | null>(null);
  const clockStampRef = useRef(0);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(480);

  const applyState = useCallback((s: GameState) => {
    gameRef.current = s;
    setGame(s);
    clockStampRef.current = Date.now();
    setClocks({ w: s.whiteMs, b: s.blackMs });
    if (s.drawOffer === null) setDrawOffered(false);
  }, []);

  // Join (invite-link flow), then subscribe to the SSE live channel.
  // If the socket drops or SSE is unsupported, fall back to 3s polling.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let es: EventSource | null = null;

    async function joinIfSeatFree(s: GameState): Promise<GameState> {
      if (!s.yourColor && s.status !== "finished") {
        if (!s.whiteJoined || !s.blackJoined) {
          try {
            await gamesApi.join(code);
            return await gamesApi.state(code);
          } catch (err) {
            // Seat was taken between poll and join → spectate, don't error out.
            if (err instanceof ApiError && err.status !== 404) {
              setSpectating(true);
              return s;
            }
            throw err;
          }
        }
        // Both seats occupied and we're not one of them → spectator.
        setSpectating(true);
      }
      return s;
    }

    function startPollingFallback() {
      if (cancelled) return;
      const poll = async () => {
        try {
          const s = await gamesApi.state(code);
          if (cancelled) return;
          applyState(s);
          setError(null);
        } catch (err) {
          if (cancelled) return;
          if (err instanceof ApiError && err.status === 404) {
            setError("Game not found — check the invite code.");
            return; // stop polling
          }
        }
        if (!cancelled && gameRef.current?.status !== "finished") {
          timer = setTimeout(poll, FALLBACK_POLL_MS);
        }
      };
      poll();
    }

    function subscribe() {
      if (cancelled || typeof EventSource === "undefined") {
        startPollingFallback();
        return;
      }
      es = new EventSource(gamesApi.eventsUrl(code), { withCredentials: true });
      es.addEventListener("state", (ev) => {
        if (cancelled) return;
        try {
          applyState(JSON.parse((ev as MessageEvent).data) as GameState);
          setError(null);
        } catch {
          /* malformed frame — next event will fix it */
        }
      });
      es.onerror = () => {
        // Socket dropped → close and fall back to polling.
        es?.close();
        es = null;
        startPollingFallback();
      };
    }

    async function boot() {
      try {
        const s0 = await gamesApi.state(code);
        if (cancelled) return;
        const s = await joinIfSeatFree(s0);
        if (cancelled) return;
        applyState(s);
        setError(null);
        if (s.status !== "finished") subscribe();
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("Game not found — check the invite code.");
          return;
        }
        // Transient network error → retry via polling fallback.
        startPollingFallback();
      }
    }

    boot();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      es?.close();
    };
  }, [code, applyState]);

  // Local clock ticking between polls
  useEffect(() => {
    const id = setInterval(() => {
      const g = gameRef.current;
      if (!g || g.status !== "active" || !g.timeMinutes) return;
      const elapsed = Date.now() - clockStampRef.current;
      const turn = g.moves.length % 2 === 0 ? "w" : "b";
      setClocks({
        w: turn === "w" ? Math.max(0, (g.whiteMs ?? 0) - elapsed) : g.whiteMs,
        b: turn === "b" ? Math.max(0, (g.blackMs ?? 0) - elapsed) : g.blackMs,
      });
    }, 250);
    return () => clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const update = () => setBoardWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [!!game, !!error]);

  const yourColor = game?.yourColor ?? null;
  const orientation = yourColor === "b" ? "black" : "white";
  const turn = game ? (game.moves.length % 2 === 0 ? "w" : "b") : "w";
  const isYourTurn = game?.status === "active" && yourColor === turn;

  const hints = useMoveHints(game?.fen ?? new Chess().fen());

  const onPieceDrop = (source: string, target: string): boolean => {
    hints.clear();
    const g = gameRef.current;
    if (!g || g.status !== "active" || !yourColor || turn !== yourColor) return false;

    // Local legality pre-check for instant feedback
    const chess = new Chess(g.fen);
    let made;
    try {
      made = chess.move({ from: source, to: target, promotion: "q" });
    } catch {
      return false;
    }
    if (!made) return false;

    // Optimistic update
    const optimistic: GameState = {
      ...g,
      fen: chess.fen(),
      moves: [...g.moves, { from: made.from, to: made.to, promotion: made.promotion ?? null, san: made.san }],
    };
    applyState(optimistic);

    gamesApi
      .move(code, { from: source, to: target, promotion: "q" }, g.moves.length)
      .then((r) => {
        const cur = gameRef.current;
        if (!cur) return;
        applyState({
          ...cur,
          moves: r.moves,
          fen: r.fen,
          whiteMs: r.whiteMs,
          blackMs: r.blackMs,
          status: r.status,
          result: r.result,
        });
      })
      .catch(async () => {
        // Server rejected → resync from authoritative state
        try {
          const s = await gamesApi.state(code);
          applyState(s);
        } catch {
          /* next poll will fix it */
        }
      });
    return true;
  };

  const inviteUrl = `${window.location.origin}/play/${code}`;

  const copyInvite = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = inviteUrl;
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        ta.remove();
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Clipboard blocked (insecure context) → select the URL for manual copy.
      setCopyFailed(true);
      requestAnimationFrame(() => {
        copyInputRef.current?.focus();
        copyInputRef.current?.select();
      });
    }
  };

  const doResign = async () => {
    setActionError(null);
    if (!confirmResign) {
      setConfirmResign(true);
      setTimeout(() => setConfirmResign(false), 3000);
      return;
    }
    setConfirmResign(false);
    try {
      await gamesApi.resign(code);
      const s = await gamesApi.state(code);
      applyState(s);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not complete the action. Please try again.");
    }
  };

  const doDraw = async (action: "offer" | "accept" | "decline") => {
    setActionError(null);
    try {
      await gamesApi.draw(code, action);
      if (action === "offer") setDrawOffered(true);
      const s = await gamesApi.state(code);
      applyState(s);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not complete the action. Please try again.");
    }
  };

  // ------------------------------------------------------------------ render

  if (error) {
    return (
      <div className="grain min-h-screen bg-cream play-workspace">
        <Navbar />
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
          <p className="font-display text-3xl font-semibold text-ink">{error}</p>
          <button
            onClick={() => navigate("/lobby")}
            className="rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream transition-all hover:bg-forest-deep"
          >
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="grain min-h-screen bg-cream play-workspace">
        <Navbar />
        <PlaySkeleton />
      </div>
    );
  }

  const waiting = game.status === "waiting" || !game.whiteJoined || !game.blackJoined;
  const finished = game.status === "finished";
  const opponentName =
    yourColor === "w" ? game.black : yourColor === "b" ? game.white : game.black;
  const yourName =
    user?.username ??
    (yourColor === "w" ? game.white : yourColor === "b" ? game.black : null) ??
    "You";
  const topClock = yourColor === "b" ? clocks.w : clocks.b;
  const bottomClock = yourColor === "b" ? clocks.b : clocks.w;
  const opponentDrawOffer = game.drawOffer && game.drawOffer !== yourColor;
  const sanMoves = game.moves.map((m) => m.san ?? `${m.from}-${m.to}`);
  const timed = game.timeMinutes > 0;

  return (
    <div className="grain min-h-screen bg-cream play-workspace">
      <Navbar />

      <section id="main-content" className="mx-auto max-w-6xl px-5 pb-16 pt-24">
        <div className="mx-auto mb-6 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            Friend match · {code}
          </span>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">
            {finished
              ? "Game over"
              : waiting
                ? "Waiting for your friend…"
                : isYourTurn
                  ? "Your move"
                  : "Opponent's move"}
          </h1>
        </div>

        {actionError && <p role="alert" className="mx-auto mb-5 max-w-xl rounded-xl bg-capture/10 p-4 text-center text-sm text-capture">{actionError}</p>}

        {/* Spectator banner */}
        {spectating && !finished && (
          <div className="mx-auto mb-8 max-w-xl rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4 text-center">
            <p className="text-sm font-semibold text-ink">
              This game already has two players — you're spectating.
            </p>
          </div>
        )}

        {/* Waiting banner with invite link */}
        {waiting && !finished && (
          <div
            id="invite-banner"
            className="mx-auto mb-8 flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-5 text-center"
          >
            <p className="text-sm text-ink-soft">
              Share this code or the invite link — the game starts as soon as they open it.
            </p>
            <p className="font-display text-3xl font-semibold tracking-[0.3em] text-forest">
              {code}
            </p>
            {/* Full URL — long-press to copy on mobile; doubles as the manual-copy
                fallback when the Clipboard API is blocked (insecure contexts). */}
            <input
              aria-label="Game invite link"
              ref={copyInputRef}
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full max-w-sm select-all rounded-xl border border-parchment bg-white/80 px-3 py-2 text-center font-mono text-xs text-ink-soft outline-none focus:border-forest"
            />
            {copyFailed && (
              <p className="text-xs font-semibold text-terracotta">
                Press Ctrl+C to copy — the link is selected above.
              </p>
            )}
            <button
              onClick={copyInvite}
              className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-all hover:bg-forest-deep active:scale-[0.98]"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied!" : "Copy invite link"}
            </button>
          </div>
        )}

        {/* Result banner */}
        {finished && (
          <div className="mx-auto mb-8 max-w-xl rounded-2xl bg-forest-deep p-5 text-center text-cream">
            <p className="font-display text-2xl font-semibold">
              {resultText(game.result, yourColor)}
            </p>
            <button
              onClick={() => navigate("/lobby")}
              className="mt-3 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-forest-deep transition-all hover:brightness-105"
            >
              Back to lobby
            </button>
          </div>
        )}

        {/* Draw offer banner */}
        {opponentDrawOffer && !finished && (
          <div className="mx-auto mb-8 flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4">
            <span className="text-sm font-semibold text-ink">
              {opponentName ?? "Your opponent"} offers a draw.
            </span>
            <button
              onClick={() => doDraw("accept")}
              className="rounded-full bg-forest px-4 py-2 text-xs font-semibold text-cream hover:bg-forest-deep"
            >
              Accept
            </button>
            <button
              onClick={() => doDraw("decline")}
              className="rounded-full border border-parchment bg-white px-4 py-2 text-xs font-semibold text-ink-soft hover:text-terracotta"
            >
              Decline
            </button>
          </div>
        )}

        <div className="mx-auto grid max-w-4xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Board column */}
          <div className="rounded-xl border border-parchment bg-white p-4 shadow-[0_20px_60px_-20px_rgba(38,35,30,0.2)]">
            {/* Opponent bar */}
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-cream">
                  {(opponentName ?? "?")[0]?.toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-ink">
                  {opponentName ?? "Waiting…"}
                </span>
                {!finished && !waiting && !isYourTurn && (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-terracotta" />
                )}
              </div>
              {timed && (
                <span
                  className={`rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${
                    !isYourTurn && !waiting && !finished
                      ? "bg-forest text-cream"
                      : "bg-parchment text-ink-soft"
                  }`}
                >
                  {fmtClock(topClock)}
                </span>
              )}
            </div>

            <div className="w-full" ref={boardWrapRef}>
              <Chessboard
                position={game.fen}
                onPieceDrop={onPieceDrop}
                onSquareClick={(square) => { if (isYourTurn) hints.onSquareClick(square, onPieceDrop); }}
                onPieceDragBegin={hints.onPieceDragBegin}
                onPieceDragEnd={hints.onPieceDragEnd}
                customSquareStyles={hints.customSquareStyles}
                boardOrientation={orientation}
                arePiecesDraggable={!!isYourTurn}
                areArrowsAllowed={false}
                boardWidth={Math.min(boardWidth, 620)}
                animationDuration={180}
                customDarkSquareStyle={{ backgroundColor: "#8e9e7c" }}
                customLightSquareStyle={{ backgroundColor: "#e9e8d5" }}
                customBoardStyle={{ borderRadius: "0px", overflow: "hidden" }}
              />
            </div>

            {/* Your bar */}
            <div className="mt-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta text-sm font-semibold text-cream">
                  {yourName[0]?.toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-ink">
                  {yourName}
                  <span className="ml-1.5 text-xs font-medium text-ink-soft">
                    ({yourColor === "b" ? "Black" : "White"})
                  </span>
                </span>
                {isYourTurn && <span className="h-2 w-2 animate-pulse rounded-full bg-forest" />}
              </div>
              {timed && (
                <span
                  className={`rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${
                    isYourTurn ? "bg-forest text-cream" : "bg-parchment text-ink-soft"
                  }`}
                >
                  {fmtClock(bottomClock)}
                </span>
              )}
            </div>

            {/* Controls */}
            {!finished && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-parchment px-1 pt-4">
                <button
                  disabled={!yourColor || waiting}
                  onClick={doResign}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    confirmResign
                      ? "bg-capture text-cream"
                      : "border border-parchment text-ink-soft hover:border-capture/40 hover:text-capture"
                  }`}
                >
                  <Flag size={14} /> {confirmResign ? "Confirm resign?" : "Resign"}
                </button>
                <button
                  onClick={() => doDraw("offer")}
                  disabled={drawOffered || waiting || !yourColor}
                  className="inline-flex items-center gap-1.5 rounded-full border border-parchment px-4 py-2 text-xs font-semibold text-ink-soft transition-all hover:border-forest/40 hover:text-forest disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Handshake size={14} /> {drawOffered ? "Draw offered…" : "Offer draw"}
                </button>
                <button
                  onClick={copyInvite}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-parchment px-4 py-2 text-xs font-semibold text-ink-soft transition-all hover:border-terracotta/40 hover:text-terracotta"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied!" : "Invite link"}
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-parchment bg-white p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                Move history
              </h2>
              {sanMoves.length === 0 ? (
                <p className="text-sm text-ink-soft/70">
                  {waiting ? "The game hasn't started yet." : "No moves yet."}
                </p>
              ) : (
                <ol className="grid max-h-64 grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 overflow-y-auto pr-1 text-sm">
                  {Array.from({ length: Math.ceil(sanMoves.length / 2) }, (_, i) => (
                    <li key={i} className="contents">
                      <span className="text-ink-soft/60">{i + 1}.</span>
                      <span
                        className={
                          2 * i === sanMoves.length - 1
                            ? "font-semibold text-forest"
                            : "text-ink-soft"
                        }
                      >
                        {sanMoves[2 * i]}
                      </span>
                      <span
                        className={
                          2 * i + 1 === sanMoves.length - 1
                            ? "font-semibold text-forest"
                            : "text-ink-soft"
                        }
                      >
                        {sanMoves[2 * i + 1] ?? ""}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="rounded-2xl border border-forest/15 bg-forest/5 p-5 text-sm leading-relaxed text-ink-soft">
              <p className="mb-2 flex items-center gap-2 font-semibold text-forest">
                <Hourglass size={15} />
                {timed
                  ? `Time control: ${game.timeMinutes}+${game.incrementSeconds}`
                  : "Unlimited time"}
              </p>
              <ul className="list-inside list-disc space-y-1.5 text-[13px]">
                <li>Moves are validated on the server — turn, legality and clocks.</li>
                <li>Making a move declines any pending draw offer.</li>
                {timed && <li>If your clock hits zero, you lose on time.</li>}
              </ul>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
