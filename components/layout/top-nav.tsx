import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const NAV_LINKS = [
  { href: "/", label: "Markets" },
  { href: "/trade-desk", label: "Trade Desk" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/strategies", label: "Strategies" },
  { href: "/analyzer", label: "Analyzer" },
  { href: "/news", label: "News" },
  { href: "/calendar", label: "Calendar" },
  { href: "/company", label: "Company" },
] as const;

export function TopNav() {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-8">
        <span className="text-lg font-bold">Trading Management</span>
        <nav className="flex items-center gap-5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search markets..."
          aria-label="Search markets"
          className="w-56 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm outline-none"
        />
        <ThemeToggle />
      </div>
    </header>
  );
}
