import { Link, Outlet } from 'react-router-dom';
import LogoMark from './LogoMark';

export default function LegalLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="px-gutter py-md max-w-3xl mx-auto flex items-center justify-between gap-md">
          <Link to="/" className="flex items-center gap-sm hover:opacity-80 transition-opacity">
            <LogoMark className="h-7 w-7" />
            <span className="font-headline-md text-headline-md font-bold text-primary">ToliarEvent</span>
          </Link>
          <a
            href="/"
            className="text-sm text-on-surface-variant hover:text-primary underline transition-colors"
          >
            Retour au site
          </a>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-outline-variant/30 py-md text-center text-on-surface-variant text-sm">
        © 2026 ToliarEvent. Fait avec ❤️ à Toliara.
      </footer>
    </div>
  );
}
