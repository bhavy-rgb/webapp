import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, SignOut } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const baseLinks = [
  { to: "/home", label: "Home" },
  { to: "/training", label: "Learn" },
  { to: "/bot", label: "Play the bot" },
  { to: "/lobby", label: "Lobby" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const links = user?.isAdmin ? [...baseLinks, { to: "/admin", label: "Admin" }] : baseLinks;

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); }
      if (event.key === "Tab") {
        const nodes = [toggleRef.current, ...Array.from(overlayRef.current?.querySelectorAll<HTMLElement>("a, button") ?? [])].filter(Boolean) as HTMLElement[];
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const media = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", onKey);
    const content = document.querySelector<HTMLElement>("main");
    const footer = document.querySelector<HTMLElement>("footer");
    if (content) content.inert = true;
    if (footer) footer.inert = true;
    return () => {
      document.body.style.overflow = previousOverflow;
      if (content) content.inert = false;
      if (footer) footer.inert = false;
      media.removeEventListener("change", closeOnDesktop);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleLogout = () => { logout(); navigate("/login"); };
  const isHome = location.pathname === "/";

  return (
    <>
      <header className="site-header">
        <nav className="island-nav" aria-label="Main navigation">
          <Link to="/home" className="brand" tabIndex={open ? -1 : undefined} aria-label="Chessify home">
            <span className="brand-mark" aria-hidden="true">♞</span> chessify<span className="text-forest">.</span>
          </Link>
          <div className="nav-links">
            {links.map(link => <NavLink key={link.to} to={link.to} className="nav-link" aria-current={isHome && link.to === "/home" ? "page" : undefined}>{link.label}</NavLink>)}
          </div>
          <div className="nav-auth">
            {user ? <><span className="avatar" title={user.username}>{user.username[0]?.toUpperCase()}</span><button onClick={handleLogout} className="nav-link" aria-label={`Log out of ${user.username}`}><SignOut size={18} /><span className="sr-only">Log out</span></button></> : <NavLink to="/login" className="btn-primary">Log in <ArrowRight size={16} /></NavLink>}
          </div>
          <button ref={toggleRef} className="menu-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close navigation" : "Open navigation"}><span /><span /></button>
        </nav>
      </header>
      {open && <div ref={overlayRef} id="mobile-navigation" className="menu-overlay" role="dialog" aria-modal="true" aria-label="Navigation">
        {links.map((link, i) => <div key={link.to} className="overflow-hidden"><motion.div initial={reducedMotion ? false : { y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .8, delay: reducedMotion ? 0 : .1 + i * .05, ease: [.32, .72, 0, 1] }}><NavLink to={link.to} className="nav-link">{link.label}<ArrowRight size={24} /></NavLink></motion.div></div>)}
        {user ? <button className="btn-primary" onClick={handleLogout}>Log out</button> : <Link to="/login" onClick={() => setOpen(false)} className="btn-primary">Log in <ArrowRight size={18} /></Link>}
      </div>}
    </>
  );
}
