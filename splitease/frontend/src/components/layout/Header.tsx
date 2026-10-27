import { Account } from "./Account";

const links = [
  { href: "#pay", label: "Split", icon: "M12 3v18M3 12h18" },
  {
    href: "#scan",
    label: "Scan",
    accessible: "Scan to pay",
    icon: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h3v3H8zm6 0h2v3h-2zm-6 6h3v2H8zm6 0h2v2h-2z",
  },
  { href: "#activity", label: "Activity", icon: "M4 5h16M4 12h16M4 19h10" },
  {
    href: "#plans",
    label: "Plans",
    icon: "M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z",
  },
  {
    href: "#balances",
    label: "Balances",
    icon: "M4 20h16M6 16v-4m6 4V4m6 12V8",
  },
  {
    href: "#help",
    label: "Help",
    icon: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m0 3h.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  },
];

export function Header() {
  const hash = location.hash || "#pay";
  function active(href: string) {
    if (href === "#scan") return hash.startsWith("#scan");
    if (href === "#plans")
      return hash === "#plans" || hash.startsWith("#plan=");
    return hash === href;
  }
  return (
    <header className="site-header">
      <a className="brand" href="#pay" aria-label="SplitEase">
        <img src="/logo.svg" alt="" width="36" height="36" />
        SplitEase
      </a>
      <nav className="primary-navigation" aria-label="Main navigation">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            aria-label={link.accessible || link.label}
            className={active(link.href) ? "active" : ""}
            aria-current={active(link.href) ? "page" : undefined}
          >
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={link.icon} />
            </svg>
            <span>{link.label}</span>
          </a>
        ))}
      </nav>
      <div className="header-account">
        <Account />
      </div>
    </header>
  );
}
