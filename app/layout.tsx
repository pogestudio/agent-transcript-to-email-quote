import Link from "next/link";
import NavLink from "../components/NavLink";
import "./globals.css";

export const metadata = {
  title: "Kvarn Quote Agent",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="brand">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <ellipse cx="12" cy="12" rx="7.5" ry="10" transform="rotate(35 12 12)" fill="currentColor" />
                <path d="M8.5 19c2.5-3 1-6.5 3.5-9.5S16 6 15.5 4.5" stroke="#f5f2ec" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
              Kvarn <span className="brand-sub">Quote agent</span>
            </Link>
            <nav className="nav">
              <NavLink href="/">Review</NavLink>
              <NavLink href="/evals">Evals</NavLink>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
