import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, Cpu, Swords } from "lucide-react";
import Navbar from "@/components/Navbar";

/** Original, lightweight vector artwork: no video or external image dependency. */
function RookArtwork() {
  return (
    <svg className="rook-artwork" viewBox="0 0 640 640" role="img" aria-labelledby="rook-art-title">
      <title id="rook-art-title">A warm ivory rook standing on a wooden chessboard</title>
      <defs>
        <linearGradient id="ivory" x1="0" x2="1"><stop stopColor="#957451"/><stop offset=".18" stopColor="#d9bb8d"/><stop offset=".4" stopColor="#f7e5c6"/><stop offset=".62" stopColor="#e8cca2"/><stop offset=".86" stopColor="#b8976b"/><stop offset="1" stopColor="#866744"/></linearGradient>
        <linearGradient id="ivory-top" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff0d4"/><stop offset="1" stopColor="#c6a275"/></linearGradient>
        <linearGradient id="board-edge" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#745339"/><stop offset="1" stopColor="#30241c"/></linearGradient>
        <radialGradient id="halo"><stop stopColor="#b58863" stopOpacity=".14"/><stop offset="1" stopColor="#b58863" stopOpacity="0"/></radialGradient>
        <filter id="piece-shadow" x="-50%" y="-30%" width="200%" height="180%"><feDropShadow dx="16" dy="23" stdDeviation="16" floodColor="#000" floodOpacity=".6"/></filter>
        <filter id="soft-shadow"><feGaussianBlur stdDeviation="14"/></filter>
      </defs>
      <circle cx="335" cy="280" r="280" fill="url(#halo)"/>
      <g fill="none" stroke="#d9bb8d" strokeOpacity=".08"><circle cx="340" cy="290" r="214"/><circle cx="340" cy="290" r="267"/><path d="M340 4v572M52 290h577" strokeDasharray="3 8"/></g>
      <ellipse cx="334" cy="531" rx="267" ry="51" fill="#000" opacity=".6" filter="url(#soft-shadow)"/>
      <path d="M38 439 340 304 624 435 324 584 38 457Z" fill="url(#board-edge)" stroke="#785738" strokeWidth="1"/>
      <path d="m38 439 286 135 300-139-284-131Z" fill="#76583e"/>
      <g transform="matrix(1.04 .48 -1.04 .48 340 311)">
        {Array.from({ length: 64 }, (_, i) => <rect key={i} x={(i % 8) * 33} y={Math.floor(i / 8) * 33} width="33" height="33" fill={(Math.floor(i / 8) + i % 8) % 2 ? "#795b43" : "#c7ab82"} />)}
        <rect width="264" height="264" fill="none" stroke="#d8b68a" strokeWidth="2"/>
      </g>
      <path d="m41 448 283 134 298-139" fill="none" stroke="#af865b" strokeOpacity=".4"/>
      <ellipse cx="362" cy="444" rx="114" ry="33" fill="#15100a" opacity=".65" filter="url(#soft-shadow)"/>
      <g filter="url(#piece-shadow)">
        <path d="M247 443v17c0 20 177 20 177 0v-17Z" fill="url(#ivory)"/>
        <ellipse cx="335.5" cy="443" rx="88.5" ry="24" fill="url(#ivory-top)"/>
        <path d="M256 428v16c0 24 159 24 159 0v-16Z" fill="url(#ivory)"/>
        <ellipse cx="335.5" cy="428" rx="79.5" ry="22" fill="url(#ivory-top)"/>
        <path d="M279 393c-3 12-9 22-17 30-4 19 153 23 148 0-10-10-15-20-18-30Z" fill="url(#ivory)"/>
        <ellipse cx="335.5" cy="395" rx="57" ry="16" fill="url(#ivory-top)"/>
        <path d="M297 242c5 74 4 112-18 148-3 19 116 21 114 0-23-39-25-84-19-148Z" fill="url(#ivory)"/>
        <path d="M305 260c2 53 2 91-8 118" fill="none" stroke="#fff1d3" strokeOpacity=".28" strokeWidth="4"/>
        <path d="M286 239v18c0 20 100 20 100 0v-18Z" fill="url(#ivory)"/>
        <ellipse cx="336" cy="239" rx="50" ry="15" fill="url(#ivory-top)"/>
        <path d="M273 199v24c0 27 126 27 126 0v-24Z" fill="url(#ivory)"/>
        <ellipse cx="336" cy="199" rx="63" ry="19" fill="url(#ivory-top)"/>
        <path d="M273 166v34c0 22 126 22 126 0v-34l-25 7v21l-25 4v-24h-26v24l-25-4v-21Z" fill="url(#ivory)"/>
        <path d="m273 166 18-9 25 5-18 11Zm50 8 0-11 26 0v11Zm51-1-18-11 25-5 18 9Z" fill="#f3dfba"/>
        <path d="m298 173 18-11v25l-18 7Zm51 1 7-12v25l-7 11Z" fill="#8d6f4d"/>
      </g>
      <g fill="#c9b497" fontFamily="Inter, sans-serif" fontSize="11" opacity=".65"><text x="94" y="481">a</text><text x="169" y="518">c</text><text x="243" y="553">e</text><text x="391" y="557">3</text><text x="470" y="520">5</text><text x="548" y="483">7</text></g>
    </svg>
  );
}

export default function Home() {
  return (
    <div className="chessify-home">
      <Navbar dark />
      <main>
        <section className="chess-hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <div className="hero-eyebrow"><span /> A CLASSIC GAME. A NEW PERSPECTIVE.</div>
            <h1 id="hero-heading">Great moves<br />start with<br /><em>you.</em></h1>
            <p className="hero-description">Learn the pieces. Find your strategy. Own the board.<br className="desktop-break" /> Your next chapter in chess starts here.</p>
            <div className="hero-actions">
              <Link to="/lobby" className="chess-button primary">Make your first move <ArrowRight size={18} /></Link>
              <a href="#explore" className="chess-button secondary">Explore Chessify <ArrowUpRight size={17} /></a>
            </div>
            <div className="hero-reassurance"><span><Check size={14} /> Free to play</span><i /><span><Check size={14} /> Every skill level</span></div>
          </div>
          <div className="hero-visual">
            <div className="art-caption"><span className="caption-line" />THE ART OF THE NEXT MOVE</div>
            <RookArtwork />
            <div className="piece-caption"><span>01 / 06</span><div><strong>The Rook</strong><p>Straight lines. Endless possibilities.</p></div><span className="piece-value">R</span></div>
          </div>
          <div className="hero-bottom"><span>THINK AHEAD. PLAY YOUR WAY.</span><a href="#explore">Discover your next move <ChevronDown size={15} /></a><span className="small-board" aria-hidden="true" /></div>
        </section>
        <section id="explore" className="chess-explore" aria-labelledby="explore-heading">
          <div className="explore-heading"><span>YOUR BOARD. YOUR JOURNEY.</span><h2 id="explore-heading">A little curiosity. <em>A better game.</em></h2></div>
          <div className="chess-features">
            {[
              { icon: BookOpen, n: "01", title: "Learn the essentials", text: "Get to know every piece, one clear move at a time.", link: "/training", label: "Start learning" },
              { icon: Cpu, n: "02", title: "Find your edge", text: "Put your ideas to the test against a bot at your level.", link: "/bot", label: "Challenge the bot" },
              { icon: Swords, n: "03", title: "Make it a match", text: "Invite a friend. Take a seat. Let the best moves win.", link: "/lobby", label: "Enter the lobby" },
            ].map(({ icon: Icon, n, title, text, link, label }) => <Link className="chess-feature" to={link} key={n}><div className="feature-top"><Icon size={23} strokeWidth={1.4} /><span>{n}</span></div><h3>{title}</h3><p>{text}</p><span className="feature-link">{label}<ArrowUpRight size={16}/></span></Link>)}
          </div>
        </section>
      </main>
      <footer className="chess-footer"><span>Chessify <span className="footer-divider">/</span> A timeless game. A fresh start.</span><div><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><span>© {new Date().getFullYear()} Chessify</span></div></footer>
    </div>
  );
}
