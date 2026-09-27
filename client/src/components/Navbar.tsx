import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const baseLinks = [
  { to: "/home", label: "Home" },
  { to: "/lobby", label: "Lobby" },
  { to: "/training", label: "Training" },
  { to: "/bot", label: "Play Bot" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Admin link only appears for admin accounts.
  const links = user?.isAdmin ? [...baseLinks, { to: "/admin", label: "Admin" }] : baseLinks;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "bg-cream/90 backdrop-blur-xl shadow-[0_1px_0_0_rgba(38,35,30,0.08)]"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/home" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-xl text-cream shadow-sm transition-transform group-hover:-rotate-6">
            ♞
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">
            Chessify
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-forest text-cream"
                    : "text-ink-soft hover:bg-parchment hover:text-ink"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        {/* Auth */}
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta text-sm font-semibold text-cream">
                {user.username[0]?.toUpperCase()}
              </span>
              <span className="text-sm font-medium text-ink">{user.username}</span>
              <button
                onClick={handleLogout}
                className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-parchment px-3.5 py-2 text-xs font-medium text-ink-soft transition-all hover:border-terracotta/40 hover:text-terracotta"
              >
                <LogOut size={14} /> Log out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-cream shadow-sm transition-all hover:bg-terracotta/90 hover:shadow-md active:scale-[0.98]"
            >
              Log in
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-ink md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-parchment bg-cream/95 backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-3 text-sm font-medium ${
                    isActive ? "bg-forest text-cream" : "text-ink-soft hover:bg-parchment"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {user ? (
              <button
                onClick={handleLogout}
                className="mt-2 flex items-center gap-2 rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-cream"
              >
                <LogOut size={16} /> Log out ({user.username})
              </button>
            ) : (
              <Link
                to="/login"
                className="mt-2 rounded-xl bg-terracotta px-4 py-3 text-center text-sm font-semibold text-cream"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
