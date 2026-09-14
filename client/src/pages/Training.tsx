import { Link, useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { ArrowRight, Info } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PieceCard } from "@/components/PieceCard";
import { ScrollReveal } from "@/components/ScrollReveal";
import { PIECES } from "@/lib/pieces";

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function Training() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("piece");
  const active = PIECES.some((piece) => piece.type === requested) ? requested : "all";
  const visiblePieces = active === "all" ? PIECES : PIECES.filter((piece) => piece.type === active);
  return (
    <div className="grain min-h-screen bg-cream training-page">
      <Navbar />

      <section id="main-content" className="mx-auto max-w-6xl px-5 pt-28">
        <ScrollReveal className="page-heading mx-auto mb-8 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            A LITTLE CURIOSITY GOES A LONG WAY
          </span>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            Six pieces. Six personalities.
          </h1>
          <p className="mt-4 text-ink-soft">
            One card per piece. Each board diagram shows where it can go, what it
            can capture, and how it gets there. Scroll and learn them all.
          </p>
          <div className="mx-auto mt-6 flex max-w-md items-start gap-2.5 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-left">
            <Info size={16} className="mt-0.5 shrink-0 text-gold" />
            <p className="text-xs leading-relaxed text-ink-soft">
              Select a piece to focus on its moves. Pawns move toward the opposite
              end of the board, capture diagonally, and can move two squares
              from their starting rank.
            </p>
          </div>
        </ScrollReveal>

        <div className="training-filter" role="group" aria-label="Filter piece lessons">
          <button onClick={() => setParams({})} aria-pressed={active === "all"}>All pieces</button>
          {PIECES.map((piece) => <button key={piece.type} onClick={() => setParams({ piece: piece.type })} aria-pressed={active === piece.type}>{piece.name}</button>)}
        </div>
        <p className="mb-5 text-center text-xs text-ink-soft" aria-live="polite">{visiblePieces.length} {visiblePieces.length === 1 ? "lesson" : "lessons"} to explore</p>
        <motion.div
          key={active}
          variants={gridVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visiblePieces.map((piece) => (
            <PieceCard key={piece.type} piece={piece} />
          ))}
        </motion.div>

        <ScrollReveal delay={0.2} className="pb-24 pt-16 text-center">
          <p className="font-display text-2xl font-semibold text-ink">
            Learned them all?
          </p>
          <p className="mt-1 text-ink-soft">Take a new idea to the board. No pressure, just practice.</p>
          <Link to="/bot" className="editorial-button primary mt-6">Try a practice game <ArrowRight size={16} /></Link>
        </ScrollReveal>
      </section>
      <Footer />
    </div>
  );
}
