import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight, BookOpen, Check, Plus, Robot, UsersThree } from "@phosphor-icons/react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BoardPreview from "@/components/BoardPreview";
import { ScrollReveal } from "@/components/ScrollReveal";
import { PIECES } from "@/lib/pieces";
import { BoardDiagram } from "@/components/BoardDiagram";

const faqs = [
  ["Is Chessify suitable for complete beginners?", "Yes. Start with the piece library to see how each of the six pieces moves and captures. Then try the bot at Beginner difficulty, with no clock to rush you."],
  ["Do I need to create an account?", "You can play the bot and invite a friend without an account. Create an account to access Home and the training library."],
  ["Can I choose how strong the bot is?", "Yes. Choose Beginner, Casual, Club, Strong, or Max. You can adjust the difficulty during a game; your choice applies to the next engine search."],
  ["Can I play with the black pieces?", "Yes. Choose Black in the bot settings and the bot makes the first move. Changing your color starts a new game."],
  ["How do I play with a friend?", "Open the lobby and choose Play a friend. Pick a time control, create a game, and share the invite link or game code. Your friend can join as a guest."],
  ["What powers the chess bot?", "Chessify uses a Rust chess engine compiled to WebAssembly. It runs in a browser worker, so the board stays responsive while it searches for a move."],
];

function TaglineWord({ children, index, count, progress }: { children: string; index: number; count: number; progress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const opacity = useTransform(progress, [index / count, (index + 1) / count], [.3, 1]);
  const reducedMotion = useReducedMotion();
  return <motion.span className="tagline-word" style={{ opacity: reducedMotion ? 1 : opacity }}>{children}{" "}</motion.span>;
}

function Tagline() {
  const ref = useRef<HTMLElement>(null);
  // Framer schedules scroll interpolation through requestAnimationFrame, never a raw scroll handler.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 60%"] });
  const lines = ["Less second guessing.", "More good moves."];
  const count = lines.join(" ").split(" ").length;
  let index = 0;
  return <section ref={ref} className="tagline-section section-space" aria-labelledby="tagline-title"><div className="page-width">
    <p className="eyebrow justify-center">Make room for a better game</p>
    <h2 id="tagline-title" className="tagline-heading">{lines.map(line => <span className="block" key={line}>{line.split(" ").map(word => <TaglineWord key={word} index={index++} count={count} progress={scrollYProgress}>{word}</TaglineWord>)}</span>)}</h2>
    <p className="mt-6 text-ink-soft">You don’t need to know every opening. Just start with your next move.</p>
  </div></section>;
}

export default function Home() {
  return <div className="home-page">
    <Navbar />
    <main id="main-content" tabIndex={-1}>
      <section className="page-width home-hero">
        <ScrollReveal className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> A good place to start playing</p>
          <h1 className="hero-heading">Your next<br />good move<br />starts here.</h1>
          <p className="hero-description">Learn how each piece moves, build confidence on the board, and practice at your own pace. A better game begins with a little play.</p>
          <Link to="/bot" className="btn-primary mt-8">Play the bot <ArrowUpRight size={20} /></Link>
          <p className="hero-reassurance"><Check size={16} /> No account needed. No clock. Just chess.</p>
        </ScrollReveal>
        <ScrollReveal delay={.15} className="hero-visual">
          <div className="visual-label"><span className="eyebrow">Your practice space</span><span className="text-xs text-ink-soft">01 / The board</span></div>
          <BoardPreview />
          <div className="floating-note"><span className="note-glyph" aria-hidden="true">♞</span><div><strong>Small moves. Real progress.</strong><p>Every game teaches you something.</p></div></div>
        </ScrollReveal>
      </section>
      <div className="page-width"><div className="proof-strip"><span>Less theory. More playing.</span><p><strong>6</strong> piece guides</p><p><strong>5</strong> bot levels</p><p><strong>1</strong> friend, a whole new game</p></div></div>

      <section className="page-width section-space" aria-labelledby="benefits-title">
        <ScrollReveal className="section-intro"><div><p className="eyebrow">Learn it. Try it. Make it yours.</p><h2 id="benefits-title" className="section-heading mt-4">A little structure.<br />A lot of possibility.</h2></div><p>You don’t need a wall of chess theory.<br />You need a clear next step and a board to try it on.</p></ScrollReveal>
        <div className="benefit-grid">
          {[
            { Icon: BookOpen, n: "01", title: "See the move, not just the rule.", text: "Six visual piece guides turn movement rules into something you can actually picture.", to: "/training", cta: "Explore the pieces", glyph: "♞", label: "Understand the board" },
            { Icon: Robot, n: "02", title: "Find your kind of challenge.", text: "From your first game to a tougher opponent, choose from five bot levels. Take your time.", to: "/bot", cta: "Play the bot", glyph: "♜", label: "Practice at your pace" },
            { Icon: UsersThree, n: "03", title: "Make it a game for two.", text: "Send a friend an invite link. Pick your colors, choose a clock, and meet across the board.", to: "/lobby", cta: "Invite a friend", glyph: "♟", label: "Better together" },
          ].map(({ Icon, n, title, text, to, cta, glyph, label }, i) => <ScrollReveal key={n} delay={i * .1}><article className="benefit-card"><div className={`benefit-art art-${i}`} aria-hidden="true"><span className="art-number">{n}</span><span className="art-piece">{glyph}</span><span className="art-caption"><Icon size={16} />{label}</span></div><div className="benefit-content"><h3>{title}</h3><p>{text}</p><Link to={to} className="text-link">{cta}<ArrowUpRight size={18} /></Link></div></article></ScrollReveal>)}
        </div>
      </section>

      <Tagline />

      <section className="page-width section-space" aria-labelledby="steps-title">
        <ScrollReveal className="section-intro"><div><p className="eyebrow">From curious to confident</p><h2 id="steps-title" className="section-heading mt-4">Your first move is simple.</h2></div><Link to="/bot" className="text-link">Let’s play <ArrowRight size={18} /></Link></ScrollReveal>
        <div className="steps-grid">{[
          ["01", "Meet the pieces", "Learn what each piece can do. Start with a pawn, or jump straight to the knight."],
          ["02", "Set your challenge", "Choose a bot level and your color. There’s no timer, so you can think things through."],
          ["03", "Learn by playing", "Drag a piece to see its legal moves. Try an idea, watch the reply, and keep going."],
        ].map(([n, title, text], i) => <ScrollReveal key={n} delay={i * .1}><article className="step-card"><span>{n}</span><h3>{title}</h3><p>{text}</p></article></ScrollReveal>)}</div>
      </section>

      <section className="piece-section section-space" aria-labelledby="pieces-title"><div className="page-width piece-layout">
        <ScrollReveal><p className="eyebrow">A closer look</p><h2 id="pieces-title" className="section-heading mt-4">Six pieces.<br />Endless possibilities.</h2><p className="mt-6 max-w-md text-ink-soft">The knight jumps. The bishop glides. Each piece has its own way of seeing the board. Get to know them, one at a time.</p><div className="piece-lineup" aria-label="The six chess pieces">{PIECES.map(piece => <span key={piece.type} title={piece.name} aria-label={piece.name}>{piece.glyph}</span>)}</div><Link className="text-link" to="/training">Open the piece library <ArrowUpRight size={18} /></Link></ScrollReveal>
        <ScrollReveal delay={.1} className="lesson-preview"><div><p className="eyebrow">A small lesson</p><h3>The knight takes a different path.</h3><p>Two squares one way, one square across.<br />And yes, it can jump over other pieces.</p></div><div className="lesson-board"><BoardDiagram piece={PIECES[1]} /></div><span className="lesson-caption"><Check size={16} /> Real movement diagrams from the piece library</span></ScrollReveal>
      </div></section>

      <section className="page-width section-space faq-layout" aria-labelledby="faq-title"><ScrollReveal><p className="eyebrow">Before you take a seat</p><h2 id="faq-title" className="section-heading mt-4">Good questions.<br />Clear answers.</h2><p className="mt-6 text-ink-soft">A few things to know before your first game.</p></ScrollReveal><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={18} /></summary><p>{answer}</p></details>)}</div></section>

      <section className="page-width pb-20"><ScrollReveal className="final-cta"><div><p className="eyebrow">The board is ready when you are</p><h2 className="section-heading mt-4">Make a move.<br />See where it takes you.</h2><p className="mt-6">No account needed for bot play. Start again whenever you like.</p><Link to="/bot" className="btn-primary mt-8">Play the bot <ArrowUpRight size={20} /></Link></div><span aria-hidden="true" className="cta-piece">♞</span></ScrollReveal></section>
    </main>
    <Footer />
  </div>;
}
