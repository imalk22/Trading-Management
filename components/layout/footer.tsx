import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Trade Desk", href: "/trade-desk" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Live Markets", href: "/" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Strategies", href: "/strategies" },
      { label: "Analyzer", href: "/analyzer" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/company" },
      { label: "News", href: "/news" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <h4 className="mb-3 text-sm font-semibold">{column.title}</h4>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
