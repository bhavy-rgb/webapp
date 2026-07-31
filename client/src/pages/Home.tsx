import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, GraduationCap, Puzzle, Swords } from "lucide-react";
import Navbar from "@/components/Navbar";
import { ScrollReveal } from "@/components/ScrollReveal";
import { PIECES } from "@/lib/pieces";
import { BoardDiagram } from "@/components/BoardDiagram";

export default function Home() {
  return (
    <div className="grain min-h-screen bg-cream">
      <Navbar />

      {/* ===== HERO ===== */}
      <section className="relative flex min-h-screen flex-col justify-center overflow-hidden pt-24">
        <div className="pointer-events-none absolute -right-40 top-10 h-[28rem] w-[28rem] rounded-full bg-forest/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-40 bottom-10 h-[24rem] w-[24rem] rounded-full bg-terracotta/10 blur-3xl" />

        <div className="relative mx-auto w-full max-w-6xl px-5">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <motion.span
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest/5 px-4 py-1.5 text-xs font-semibold text-forest"
              >
                <GraduationCap size={14} /> Learn chess, piece by piece
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                className="mt-6 font-display text-6xl font-semibold leading-[0.95] tracking-tight text-ink sm:text-7xl"
              >
                Every piece,
                <br />
                <span className="italic text-forest">one clear move.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft"
              >
                Stop guessing how the knight moves. Chessify shows you every legal
                move of every piece on a real board — then lets you practice
                against a bot.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                className="mt-9 flex flex-wrap gap-3"
              >
                <Link
                  to="/training"
                  className="inline-flex items-center gap-2 rounded-full bg-forest px-7 py-3.5 text-sm font-semibold text-cream shadow-md transition-all hover:bg-forest-deep hover:shadow-lg active:scale-[0.98]"
                >
                  Start training <ArrowRight size={16} />
                </Link>
                <Link
                  to="/lobby"
                  className="inline-flex items-center gap-2 rounded-full border border-forest/25 px-7 py-3.5 text-sm font-semibold text-forest transition-all hover:border-forest hover:bg-forest/5"
                >
                  Enter the lobby
                </Link>
              </motion.div>
            </div>

            {/* Piece diagram */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
              className="mx-auto w-full max-w-[300px]"
            >
              <div className="rounded-3xl border border-parchment bg-white p-5 shadow-[0_20px_60px_-20px_rgba(38,35,30,0.2)]">
                <BoardDiagram piece={PIECES[1]} />
                <p className="mt-3 text-center text-sm font-medium text-ink-soft">
                  The knight — <span className="text-ink">an L-shape, every time.</span>
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="absolute bottom-7 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="flex flex-col items-center gap-1 text-ink-soft/70"
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest">Scroll</span>
            <ChevronDown size={18} />
          </motion.div>
        </motion.div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <ScrollReveal className="mx-auto mb-14 max-w-xl text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            From first move to first win
          </h2>
          <p className="mt-4 text-ink-soft">
            Three focused tools — no clutter, no theory dumps. Just clear movement
            rules and a safe place to practice them.
          </p>
        </ScrollReveal>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Puzzle,
              title: "Piece library",
              desc: "Six cards — one per piece — each with a live board diagram of its legal moves and captures.",
              to: "/training",
              cta: "Open the library",
            },
            {
              icon: Swords,
              title: "Play the bot",
              desc: "Put what you learned to the test. A real chess engine on the backend picks legal replies to your moves.",
              to: "/bot",
              cta: "Challenge the bot",
            },
            {
              icon: GraduationCap,
              title: "Learn at your pace",
              desc: "Scroll-down reveals keep each lesson digestible — one concept per screen as you scroll.",
              to: "/lobby",
              cta: "See all modes",
            },
          ].map((feature, i) => (
            <ScrollReveal key={feature.title} delay={i * 0.12}>
              <Link
                to={feature.to}
                className="group flex h-full flex-col rounded-2xl border border-parchment bg-white p-7 shadow-[0_1px_2px_rgba(38,35,30,0.05)] transition-all duration-300 hover:-translate-y-1.5 hover:border-forest/30 hover:shadow-xl hover:shadow-forest/10"
              >
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-forest/10 text-forest transition-transform duration-300 group-hover:scale-110">
                  <feature.icon size={22} />
                </span>
                <h3 className="font-display text-2xl font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{feature.desc}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-forest transition-all group-hover:gap-3">
                  {feature.cta} <ArrowRight size={15} />
                </span>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ===== PIECE PREVIEW ===== */}
      <section className="bg-forest-deep py-24 text-cream">
        <div className="mx-auto max-w-6xl px-5">
          <ScrollReveal className="mb-14 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-gold">
              The lineup
            </span>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Six pieces. Six personalities.
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {PIECES.map((piece, i) => (
              <ScrollReveal key={piece.type} delay={i * 0.07} y={24}>
                <div className="group flex flex-col items-center rounded-2xl border border-cream/10 bg-cream/5 p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:bg-cream/10">
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full text-4xl transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${piece.accent}30` }}
                  >
                    {piece.glyph}
                  </span>
                  <span className="mt-3 font-display text-lg font-semibold">{piece.name}</span>
                  <span className="mt-1 text-[11px] leading-snug text-cream/60">{piece.tagline}</span>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={0.15} className="mt-12 text-center">
            <Link
              to="/training"
              className="inline-flex items-center gap-2 rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-forest-deep shadow-lg transition-all hover:bg-cream active:scale-[0.98]"
            >
              Explore every piece <ArrowRight size={16} />
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-3xl bg-forest px-8 py-16 text-center text-cream shadow-[0_30px_80px_-30px_rgba(35,70,58,0.6)] sm:px-16">
            <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-gold/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-terracotta/25 blur-2xl" />
            <h2 className="relative font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Ready to make your first move?
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-cream/80">
              Learn all six pieces in under ten minutes — then test yourself against
              the bot in the lobby.
            </p>
            <Link
              to="/lobby"
              className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-cream px-8 py-3.5 text-sm font-semibold text-forest-deep shadow-md transition-all hover:bg-gold active:scale-[0.98]"
            >
              Go to the lobby <ArrowRight size={16} />
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
