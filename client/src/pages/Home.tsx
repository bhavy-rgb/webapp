import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, BookOpen, Cpu, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Bot from "@/pages/Bot";
import Lobby from "@/pages/Lobby";
import { BoardDiagram } from "@/components/BoardDiagram";
import { PIECES } from "@/lib/pieces";

const modes = [
  { id: "bot", icon: Cpu, title: "Play the bot", note: "A little practice. A worthy opponent." },
  { id: "friend", icon: Users, title: "Play a friend", note: "Good company. A great game." },
  { id: "learn", icon: BookOpen, title: "Learn the game", note: "Small lessons. Lasting confidence." },
] as const;
type Mode = typeof modes[number]["id"];

// Original vector artwork: no external image or heavy 3D runtime required.
function RookArtwork() {
  return (
    <div className="rook-art">
      <div className="art-label"><span>THE GAME, IN A NEW LIGHT</span><span>NO. 001</span></div>
      <div className="art-orbit" />
      <svg className="rook-sculpture" viewBox="0 0 500 440" role="img" aria-label="Sculptural forest-green rook on a sage chessboard">
        <defs>
          <linearGradient id="rook-body" x1="0" x2="1"><stop stopColor="#142e25"/><stop offset=".38" stopColor="#45634c"/><stop offset=".66" stopColor="#3b5743"/><stop offset="1" stopColor="#162e25"/></linearGradient>
          <linearGradient id="rook-top" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#829375"/><stop offset="1" stopColor="#304d3a"/></linearGradient>
          <radialGradient id="rook-shadow"><stop stopColor="#233b2a" stopOpacity=".35"/><stop offset="1" stopColor="#233b2a" stopOpacity="0"/></radialGradient>
          <pattern id="art-board" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="#d8decd"/><path d="M0 0h50v50H0zM50 50h50v50H50z" fill="#b6c2a7"/></pattern>
        </defs>
        <path d="M45 350 270 256 477 339 253 432Z" fill="url(#art-board)" opacity=".72"/>
        <ellipse cx="270" cy="349" rx="132" ry="37" fill="url(#rook-shadow)"/>
        <g transform="translate(5,-8)">
          <path d="M171 323q79-33 158 0v22q-79 36-158 0Z" fill="url(#rook-body)"/>
          <ellipse cx="250" cy="323" rx="79" ry="25" fill="url(#rook-top)"/>
          <path d="M183 305q67-24 134 0v20q-67 29-134 0Z" fill="url(#rook-body)"/>
          <ellipse cx="250" cy="305" rx="67" ry="22" fill="url(#rook-top)"/>
          <path d="M213 189q7 62-17 107 54 29 108 0-24-45-17-107Z" fill="url(#rook-body)"/>
          <path d="M200 175q50-19 100 0v23q-50 22-100 0Z" fill="url(#rook-body)"/>
          <ellipse cx="250" cy="175" rx="50" ry="17" fill="url(#rook-top)"/>
          <path d="M190 114v57q60 35 120 0v-57l-25 8v22l-23 5v-26l-25 1v25l-23-6v-23Z" fill="url(#rook-body)"/>
          <path d="m190 114 18-12 24 9-18 9Zm47 10 19-13 25-1-19 13Zm48-2 17-12 25-8-17 12Z" fill="#829375"/>
          <path d="m310 114 17-12v56l-17 13Z" fill="#1b3429"/>
          <path d="M220 210q4 46-8 71" fill="none" stroke="#7a8d6d" strokeOpacity=".3" strokeWidth="3"/>
        </g>
      </svg>
      <div className="art-number">64<span>SQUARES.<br/>ENDLESS STORIES.</span></div>
      <div className="art-caption"><span>THE ROOK</span><small>Strong. Steady. Full of possibility.</small></div>
      <div className="art-baseline"><span><i/> YOUR MOVE, ALWAYS.</span><span>a1 — h8</span></div>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("bot");
  const selectMode = (next: Mode) => {
    setMode(next);
  };
  return (
    <div className="editorial-home grain min-h-screen bg-cream">
      <Navbar />
      <main id="main-content" className="home-main">
        <section className="home-hero">
          <div className="hero-copy">
            <span className="eyebrow"><span className="tiny-checker"/> A LITTLE PLAY. A SHARPER MIND.</span>
            <h1>Your next move.<br/><em>Your own pace.</em></h1>
            <p>A quiet corner of the internet for a beautiful game.<br className="desktop-break"/> Play a bot, challenge a friend, or simply get better.</p>
            <div className="hero-actions">
              <a href="#take-your-seat" className="editorial-button" onClick={() => selectMode("bot")}>Let’s play <ArrowRight size={16}/></a>
              <Link to="/training" className="editorial-text-link">New to chess? Start here <ArrowRight size={14}/></Link>
            </div>
            <div className="hero-footnote"><span aria-hidden="true">♟♞♜</span>Every grandmaster started with a first move.</div>
          </div>
          <RookArtwork />
        </section>
        <div className="club-strip"><span className="eyebrow">NO PRESSURE. JUST PLAY.</span><p>For the first-timers. The overthinkers. The <em>“one more game”</em> people.</p><span className="strip-star" aria-hidden="true">✳</span></div>
        <section id="take-your-seat" className="home-play">
          <div className="section-heading"><div><span className="eyebrow">01 / TAKE YOUR SEAT</span><h2>There’s a game for every mood.</h2></div><p>Pick your way to play. <ArrowDown size={13}/></p></div>
          <div className="mode-tabs" aria-label="Choose how to play">
            {modes.map((item, i) => <button key={item.id} className={`mode-tab ${mode === item.id ? "selected" : ""}`} aria-pressed={mode === item.id} aria-controls={`mode-${item.id}`} onClick={() => selectMode(item.id)}><item.icon size={23} strokeWidth={1.4}/><span><strong>{item.title}</strong><small>{item.note}</small></span><span className="tab-number">0{i+1}</span></button>)}
          </div>
          {/* Keep an active game mounted when exploring other modes. */}
          <div id="mode-bot" hidden={mode !== "bot"}>
            <Bot embedded />
          </div>
          <div id="mode-friend" hidden={mode !== "friend"}>
            {mode === "friend" && <div className="friend-layout"><div className="friend-intro"><span className="eyebrow">BETTER WITH COMPANY</span><h3>A familiar face.<br/><em>A fresh challenge.</em></h3><p>One invite link is all it takes. Choose your clock, pick a side, and meet your friend on the board.</p><div className="friend-pieces" aria-hidden="true">♔ ♚</div><span className="eyebrow">LIVE GAMES · NO ACCOUNT NEEDED</span></div><Lobby embedded /></div>}
          </div>
          <div id="mode-learn" hidden={mode !== "learn"}>
            {mode === "learn" && <div className="learn-panel"><div><span className="eyebrow">SIX PIECES. ENDLESS POSSIBILITIES.</span><h3>Every great game<br/>starts with the basics.</h3><p>Discover how each piece moves, where it can capture, and what makes it special. All six interactive lessons are waiting for you.</p><Link className="editorial-button" to="/training">Open the piece library <ArrowRight size={16}/></Link></div><div className="learn-lineup">{PIECES.map(piece => <Link to={`/training?piece=${piece.type}`} key={piece.type}><span>{piece.glyph}</span><strong>{piece.name}</strong><small>{piece.tagline}</small></Link>)}</div></div>}
          </div>
        </section>
        <section className="home-learn">
          <div className="learn-intro"><span className="eyebrow">02 / STAY CURIOUS</span><h2>Better, one<br/><em>move at a time.</em></h2><p>There’s always something new on the board.</p><Link to="/training" className="editorial-text-link">Explore the lessons <ArrowRight size={14}/></Link></div>
          <Link to="/training" className="lesson-card"><div className="lesson-art"><BoardDiagram piece={PIECES[1]}/></div><div className="lesson-copy"><span className="eyebrow">THE FOUNDATIONS / 01</span><h3>Meet your pieces <ArrowRight size={18}/></h3><p>Six personalities. Find out what makes each one move.</p></div></Link>
          <Link to="/bot" className="practice-card"><span className="eyebrow">A LITTLE PRACTICE GOES A LONG WAY</span><span className="practice-piece" aria-hidden="true">♞</span><div><span className="practice-tag">FIVE DIFFICULTY LEVELS</span><h3>Make room<br/>for a little play.</h3><p>A worthy opponent, at your own pace.</p><span className="practice-link">Challenge the bot <ArrowRight size={16}/></span></div></Link>
        </section>
        <div className="closing-note"><span aria-hidden="true">♜</span><p>Not every move has to be brilliant.<br/><em>Sometimes, it just has to be yours.</em></p><small>a1 — h8</small></div>
      </main>
      <Footer />
    </div>
  );
}
