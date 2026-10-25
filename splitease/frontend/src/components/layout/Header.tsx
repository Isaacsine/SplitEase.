import { useEffect, useRef, useState } from "react";
import { Account } from "./Account";
export function Header({ activity }: { activity: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef<HTMLElement>(null),
    toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const close = () => setMenuOpen(false);
    const outside = (e: PointerEvent) => {
      if (!header.current?.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        close();
        toggle.current?.focus();
      }
    };
    const media = window.matchMedia("(min-width:901px)");
    const resize = () => {
      if (media.matches) close();
    };
    window.addEventListener("hashchange", close);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    media.addEventListener("change", resize);
    return () => {
      window.removeEventListener("hashchange", close);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      media.removeEventListener("change", resize);
    };
  }, [menuOpen]);
  return (
    <header ref={header}>
      <a className="brand" href="#pay">
        <img src="/logo.svg" alt="" />
        SplitEase
      </a>
      <button
        ref={toggle}
        type="button"
        className="nav-toggle"
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={menuOpen}
        aria-controls="main-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {menuOpen ? (
            <path d="m6 6 12 12M18 6 6 18" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
      <nav
        id="main-navigation"
        aria-label="Main navigation"
        className={menuOpen ? "navigation-open" : ""}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
        }}
      >
        <a
          className={
            !activity &&
            !["#scan", "#balances", "#receipt", "#plans", "#wallet"].includes(
              location.hash,
            ) &&
            !location.hash.startsWith("#plan=")
              ? "active"
              : ""
          }
          href="#pay"
        >
          Split
        </a>
        <a href="#scan" className={location.hash === "#scan" ? "active" : ""}>
          Scan to pay
        </a>
        <a className={activity ? "active" : ""} href="#activity">
          Activity
        </a>
        <a
          className={location.hash === "#balances" ? "active" : ""}
          href="#balances"
        >
          Balances
        </a>
        <a
          aria-label="Plans"
          href="#plans"
          className={
            location.hash === "#plans" || location.hash.startsWith("#plan=")
              ? "active"
              : ""
          }
        >
          Monthly plans & stokvels
        </a>
        <a
          href="#wallet"
          className={location.hash === "#wallet" ? "active" : ""}
        >
          Wallet
        </a>
      </nav>
      <div className="header-account" onClick={() => setMenuOpen(false)}>
        <Account />
      </div>
    </header>
  );
}
