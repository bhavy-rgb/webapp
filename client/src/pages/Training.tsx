import { motion } from "framer-motion";
import { Info } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PieceCard } from "@/components/PieceCard";
import { ScrollReveal } from "@/components/ScrollReveal";
import { PIECES } from "@/lib/pieces";

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function Training() {
  return (
    <div className="grain min-h-screen bg-cream">
      <Navbar />

      <section className="mx-auto max-w-6xl px-5 pt-28">
        <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            Training mode
          </span>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            The piece library
          </h1>
          <p className="mt-4 text-ink-soft">
            One card per piece. Each board diagram shows where it can go, what it
            can capture, and how it gets there. Scroll and learn them all.
          </p>
          <div className="mx-auto mt-6 flex max-w-md items-start gap-2.5 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-left">
            <Info size={16} className="mt-0.5 shrink-0 text-gold" />
            <p className="text-xs leading-relaxed text-ink-soft">
              Movement rules are per <em>type</em>, not per instance — a pawn on a2
              moves exactly like a pawn on h7 — so we show one card per piece
              instead of 32 duplicates.
            </p>
          </div>
        </ScrollReveal>

        <motion.div
          variants={gridVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {PIECES.map((piece) => (
            <PieceCard key={piece.type} piece={piece} />
          ))}
        </motion.div>

        <ScrollReveal delay={0.2} className="pb-24 pt-16 text-center">
          <p className="font-display text-2xl font-semibold text-ink">
            Learned them all?
          </p>
          <p className="mt-1 text-ink-soft">Now prove it against the bot.</p>
        </ScrollReveal>
      </section>
    </div>
  );
}
