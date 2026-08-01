import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Swords, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import { ScrollReveal } from "@/components/ScrollReveal";
import { ApiError, gamesApi } from "@/api";

const TIME_CONTROLS = [
  { label: "3+0", min: 3, inc: 0 },
  { label: "5+2", min: 5, inc: 2 },
  { label: "10+0", min: 10, inc: 0 },
  { label: "15+10", min: 15, inc: 10 },
  { label: "∞", min: 0, inc: 0 },
];

export default function Lobby() {
  const navigate = useNavigate();
  const [friendOpen, setFriendOpen] = useState(false);
  const [tab, setTab] = useState<"create" | "join">("create");
  const [color, setColor] = useState<"w" | "b" | "random">("random");
  const [tc, setTc] = useState(4); // index into TIME_CONTROLS, default unlimited
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGame = async () => {
    setBusy(true);
    setError(null);
    try {
      const { min, inc } = TIME_CONTROLS[tc];
      const res = await gamesApi.create({ color, timeMinutes: min, incrementSeconds: inc });
      navigate(`/play/${res.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the game");
      setBusy(false);
    }
  };

  const joinGame = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setError("Enter the 6-character game code");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await gamesApi.join(code);
      navigate(`/play/${code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join the game");
      setBusy(false);
    }
  };

  return (
    <div className="grain min-h-screen bg-cream">
      <Navbar />

      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 pb-16 pt-28">
        <ScrollReveal className="mb-14 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            The lobby
          </span>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            Where do you want to start?
          </h1>
          <p className="mx-auto mt-4 max-w-md text-ink-soft">
            Three modes. One goal: making every piece feel second nature.
          </p>
        </ScrollReveal>

        <div className="grid gap-6 md:grid-cols-3">
          <ScrollReveal direction="left">
            <Link
              to="/training"
              className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-parchment bg-white p-8 shadow-[0_1px_2px_rgba(38,35,30,0.05)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-forest/10"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-forest/10 blur-2xl transition-transform duration-500 group-hover:scale-150" />
              <div>
                <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest text-cream shadow-md transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                  <BookOpen size={26} />
                </span>
                <h2 className="font-display text-3xl font-semibold text-ink">Training mode</h2>
                <p className="mt-3 max-w-sm leading-relaxed text-ink-soft">
                  The piece gallery. Six cards, six boards — each diagram animates
                  the legal moves and captures, so the rules stick.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 font-semibold text-forest transition-all group-hover:gap-4">
                Open the piece library <ArrowRight size={18} />
              </div>
            </Link>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <Link
              to="/bot"
              className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-forest-deep p-8 text-cream shadow-[0_20px_60px_-20px_rgba(35,70,58,0.5)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-forest/20"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-2xl transition-transform duration-500 group-hover:scale-150" />
              <div>
                <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold text-forest-deep shadow-md transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                  <Swords size={26} />
                </span>
                <h2 className="font-display text-3xl font-semibold">Play the bot</h2>
                <p className="mt-3 max-w-sm leading-relaxed text-cream/75">
                  A real board with legal-move validation. The bot answers your
                  moves — a safe place to try everything you just learned.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 font-semibold text-gold transition-all group-hover:gap-4">
                Challenge the bot <ArrowRight size={18} />
              </div>
            </Link>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={0.1}>
            <button
              id="play-friend-card"
              onClick={() => {
                setFriendOpen(true);
                setError(null);
              }}
              className="group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-3xl border border-terracotta/25 bg-white p-8 text-left shadow-[0_1px_2px_rgba(38,35,30,0.05)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-terracotta/15"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-terracotta/15 blur-2xl transition-transform duration-500 group-hover:scale-150" />
              <div>
                <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-terracotta text-cream shadow-md transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                  <Users size={26} />
                </span>
                <h2 className="font-display text-3xl font-semibold text-ink">Play a friend</h2>
                <p className="mt-3 max-w-sm leading-relaxed text-ink-soft">
                  Create a live 1v1 game and share the invite link — clocks,
                  resignations and draw offers, all synced online.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 font-semibold text-terracotta transition-all group-hover:gap-4">
                Create or join a game <ArrowRight size={18} />
              </div>
            </button>
          </ScrollReveal>
        </div>
      </section>

      {/* -------- Play-a-friend modal -------- */}
      {friendOpen && (
        <div
          id="friend-modal"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setFriendOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-parchment bg-cream p-7 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="font-display text-2xl font-semibold text-ink">Play a friend</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  Create a game and share the link, or join with a code.
                </p>
              </div>
              <button
                onClick={() => setFriendOpen(false)}
                className="rounded-full p-2 text-ink-soft hover:bg-parchment"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-parchment p-1">
              {(["create", "join"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setError(null);
                  }}
                  className={`rounded-full py-2 text-sm font-semibold capitalize transition-all ${
                    tab === t ? "bg-forest text-cream shadow-sm" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {t === "create" ? "Create game" : "Join with code"}
                </button>
              ))}
            </div>

            {tab === "create" ? (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                    Time control
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TIME_CONTROLS.map((t, i) => (
                      <button
                        key={t.label}
                        onClick={() => setTc(i)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                          tc === i
                            ? "bg-forest text-cream"
                            : "border border-parchment bg-white text-ink-soft hover:text-ink"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                    Your color
                  </p>
                  <div className="flex gap-2">
                    {(
                      [
                        { v: "w", label: "♔ White" },
                        { v: "random", label: "🎲 Random" },
                        { v: "b", label: "♚ Black" },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.v}
                        onClick={() => setColor(c.v)}
                        className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                          color === c.v
                            ? "bg-forest text-cream"
                            : "border border-parchment bg-white text-ink-soft hover:text-ink"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={createGame}
                  disabled={busy}
                  className="w-full rounded-full bg-terracotta py-3 text-sm font-semibold text-cream shadow-sm transition-all hover:bg-terracotta/90 active:scale-[0.99] disabled:opacity-60"
                >
                  {busy ? "Creating…" : "Create game & get invite link"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && joinGame()}
                  maxLength={6}
                  placeholder="e.g. AB3XY9"
                  className="w-full rounded-xl border border-parchment bg-white px-4 py-3 text-center font-display text-2xl font-semibold tracking-[0.3em] text-ink outline-none transition-all placeholder:tracking-normal placeholder:text-ink-soft/40 focus:border-forest"
                />
                <button
                  onClick={joinGame}
                  disabled={busy}
                  className="w-full rounded-full bg-terracotta py-3 text-sm font-semibold text-cream shadow-sm transition-all hover:bg-terracotta/90 active:scale-[0.99] disabled:opacity-60"
                >
                  {busy ? "Joining…" : "Join game"}
                </button>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-capture/10 px-4 py-2.5 text-center text-sm font-medium text-capture">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
