import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-parchment bg-cream">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-ink-soft sm:flex-row">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <span className="text-base">♞</span> Chessify
        </span>
        <nav className="flex items-center gap-5">
          <Link to="/terms" className="transition-colors hover:text-forest">
            Terms
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-forest">
            Privacy
          </Link>
          <Link to="/lobby" className="transition-colors hover:text-forest">
            Lobby
          </Link>
        </nav>
        <span className="text-ink-soft/70">© {new Date().getFullYear()} Chessify</span>
      </div>
    </footer>
  );
}
