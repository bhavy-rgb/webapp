import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Swords } from "lucide-react";
import Navbar from "@/components/Navbar";
import { ScrollReveal } from "@/components/ScrollReveal";

export default function Lobby() {
  return (
    <div className="grain min-h-screen bg-cream">
      <Navbar />

      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 pt-24">
        <ScrollReveal className="mb-14 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            The lobby
          </span>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            Where do you want to start?
          </h1>
          <p className="mx-auto mt-4 max-w-md text-ink-soft">
            Two modes. One goal: making every piece feel second nature.
          </p>
        </ScrollReveal>

        <div className="grid gap-6 md:grid-cols-2">
          <ScrollReveal direction="left">
            <Link
              to="/training"
              className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-parchment bg-white p-9 shadow-[0_1px_2px_rgba(38,35,30,0.05)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-forest/10"
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

          <ScrollReveal direction="right" delay={0.1}>
            <Link
              to="/bot"
              className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-forest-deep p-9 text-cream shadow-[0_20px_60px_-20px_rgba(35,70,58,0.5)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-forest/20"
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
        </div>
      </section>
    </div>
  );
}
