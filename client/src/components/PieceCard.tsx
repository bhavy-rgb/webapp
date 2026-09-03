import { motion } from "framer-motion";
import type { PieceDef } from "@/lib/pieces";
import { BoardDiagram } from "@/components/BoardDiagram";

import type { Variants } from "framer-motion";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
  },
};

export function PieceCard({ piece }: { piece: PieceDef }) {
  return (
    <motion.article
      variants={cardVariants}
      whileHover={{ y: -6 }}
      className="group flex flex-col rounded-2xl border border-parchment bg-white p-5 shadow-[0_1px_2px_rgba(38,35,30,0.05)] transition-shadow hover:shadow-xl hover:shadow-forest/10"
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl text-3xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
          style={{ backgroundColor: `${piece.accent}18` }}
        >
          {piece.glyph}
        </span>
        <div>
          <h3 className="font-display text-2xl font-semibold leading-none text-ink">
            {piece.name}
          </h3>
          <p className="mt-1 text-xs font-medium" style={{ color: piece.accent }}>
            {piece.tagline}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[220px]">
        <BoardDiagram piece={piece} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">{piece.description}</p>
    </motion.article>
  );
}
