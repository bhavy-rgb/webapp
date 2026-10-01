import { Link } from "react-router-dom";

export default function Footer() {
  return <footer className="site-footer"><div className="page-width footer-inner">
    <Link to="/home" className="brand" aria-label="Chessify home"><span className="brand-mark" aria-hidden="true">♞</span> chessify.</Link>
    <p>A little practice. A better game.</p>
    <nav aria-label="Footer navigation"><Link to="/lobby">Lobby</Link><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms</Link></nav>
    <p>© {new Date().getFullYear()} Chessify</p>
  </div></footer>;
}
