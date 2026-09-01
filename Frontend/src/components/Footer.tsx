import { Link } from 'react-router-dom';
import LogoMark from './LogoMark';

export default function Footer() {
  return (
    <footer className="landing-footer relative">
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--landing-border-strong) 50%, transparent)',
        }}
      />

      <div className="landing-container grid grid-cols-1 md:grid-cols-3 gap-10 py-16">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="font-landing-display text-lg font-bold landing-heading">ToliarEvent</span>
          </div>
          <p className="landing-text-subtle text-sm leading-relaxed max-w-xs">
            Précision logistique au cœur de Toliara. La plateforme conçue par des organisateurs,
            pour des organisateurs.
          </p>
        </div>

        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] landing-footer-heading mb-5">
            Navigation
          </h4>
          <ul className="space-y-3">
            <li><Link to="/" className="landing-footer-link text-sm">Accueil</Link></li>
            <li><Link to="/evenements" className="landing-footer-link text-sm">Événements</Link></li>
            <li><Link to="/#a-propos" className="landing-footer-link text-sm">Fonctionnalités</Link></li>
            <li><Link to="/#contact" className="landing-footer-link text-sm">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] landing-footer-heading mb-5">
            Légal
          </h4>
          <ul className="space-y-3">
            <li>
              <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="landing-footer-link text-sm">
                Politique de confidentialité
              </a>
            </li>
            <li>
              <a href="/cgu" target="_blank" rel="noopener noreferrer" className="landing-footer-link text-sm">
                Conditions d&apos;utilisation
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--landing-border)] py-5 text-center landing-text-subtle text-sm">
        © 2026 ToliarEvent — Fait à Toliara, Madagascar
      </div>
    </footer>
  );
}
