import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="grain flex min-h-screen items-center justify-center bg-cream px-5">
      <div className="text-center">
        <p className="font-display text-7xl font-semibold text-forest">♞ 404</p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
          That square is off the board.
        </h1>
        <p className="mt-3 text-ink-soft">The page you're looking for doesn't exist.</p>
        <Link
          to="/home"
          className="mt-8 inline-block rounded-full bg-forest px-7 py-3 text-sm font-semibold text-cream transition-all hover:bg-forest-deep"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
