import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <Link to="/home" className="site-brand"><span aria-hidden="true">♜</span>Chessify<span className="brand-dot">.</span></Link>
      <p>A little play. A sharper mind.</p>
      <nav aria-label="Footer navigation"><Link to="/training">Learn</Link><Link to="/lobby">Lobby</Link><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link></nav>
      <small>© {new Date().getFullYear()} Chessify</small>
    </footer>
  );
}
