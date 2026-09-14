import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const baseLinks = [
  { to: "/home", label: "Discover" },
  { to: "/lobby", label: "Play a friend" },
  { to: "/training", label: "Learn" },
  { to: "/bot", label: "Play Bot" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const links = user?.isAdmin ? [...baseLinks, { to: "/admin", label: "Admin" }] : baseLinks;
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) { setOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const handleLogout = () => { logout(); navigate("/login"); };
  const navLinks = links.map(link => <NavLink key={link.to} to={link.to} className={({ isActive }) => `nav-link ${isActive || (link.to === "/home" && location.pathname === "/") ? "is-active" : ""}`}>{link.label}</NavLink>);
  return (
    <header className="site-header">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <nav className="header-inner" aria-label="Main navigation">
        <Link to="/home" className="site-brand" aria-label="Chessify home"><span aria-hidden="true">♜</span>Chessify<span className="brand-dot">.</span></Link>
        <div className="desktop-nav">{navLinks}</div>
        <div className="header-actions"><span className="header-note"><i/> A good day for a game.</span>{user ? <><span className="header-user" title={user.username}>{user.username}</span><button onClick={handleLogout} className="account-button" aria-label="Log out"><LogOut size={16}/></button></> : <Link to="/login" className="account-button">Log in <ArrowUpRight size={14}/></Link>}</div>
        <button ref={toggleRef} onClick={() => setOpen(value => !value)} className="menu-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-navigation">{open ? <X size={23}/> : <Menu size={23}/>}</button>
      </nav>
      {open && <div id="mobile-navigation" className="mobile-nav">{navLinks}{user ? <button onClick={handleLogout}>Log out ({user.username})</button> : <Link to="/login">Log in / Create account</Link>}</div>}
    </header>
  );
}
