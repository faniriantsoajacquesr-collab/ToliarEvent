import { Link, Outlet } from 'react-router-dom';
import LogoMark from './LogoMark';
import ThemeToggle from './ThemeToggle';

export default function LegalLayout() {
  return (
    <div className="landing-page min-h-screen flex flex-col bg-[var(--landing-bg)]">
      <header className="landing-header landing-header--scrolled border-b border-[var(--landing-header-border)]">
        <div className="px-gutter py-4 max-w-3xl mx-auto flex items-center justify-between gap-md">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <LogoMark className="h-7 w-7" />
            <span className="font-landing-display text-lg font-bold landing-nav-brand">ToliarEvent</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/" className="landing-nav-link text-sm font-medium hover:underline">
              Retour au site
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="landing-footer py-8 text-center landing-text-subtle text-sm">
        © 2026 ToliarEvent. Fait avec ❤️ à Toliara.
      </footer>
    </div>
  );
}
