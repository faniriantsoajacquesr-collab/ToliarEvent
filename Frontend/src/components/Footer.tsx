import { Link } from 'react-router-dom';
import LogoMark from './LogoMark';

const legalLinkClass =
  'text-on-surface-variant hover:text-primary underline transition-colors';

export default function Footer() {
  return (
    <footer className="bg-surface-container-low border-t border-outline-variant">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg px-gutter py-xl max-w-container-max mx-auto">
        <div className="space-y-md">
          <div className="flex items-center gap-sm">
            <LogoMark className="h-8 w-8" />
            <span className="font-headline-md text-headline-md font-bold text-primary">
              ToliarEvent
            </span>
          </div>
          <p className="font-body-md text-on-surface-variant pr-md">
            Précision logistique au cœur de Toliara. La plateforme conçue par
            des organisateurs, pour des organisateurs.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-on-surface mb-lg">Navigation</h4>
          <ul className="space-y-sm">
            <li>
              <Link to="/" className={legalLinkClass}>
                Accueil
              </Link>
            </li>
            <li>
              <Link to="/evenements" className={legalLinkClass}>
                Événements
              </Link>
            </li>
            <li>
              <Link to="/#a-propos" className={legalLinkClass}>
                À propos
              </Link>
            </li>
            <li>
              <Link to="/#contact" className={legalLinkClass}>
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-on-surface mb-lg">Légal</h4>
          <ul className="space-y-sm">
            <li>
              <a
                href="/confidentialite"
                target="_blank"
                rel="noopener noreferrer"
                className={legalLinkClass}
              >
                Politique de confidentialité
              </a>
            </li>
            <li>
              <a
                href="/cgu"
                target="_blank"
                rel="noopener noreferrer"
                className={legalLinkClass}
              >
                Conditions d&apos;utilisation
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-outline-variant/30 py-md text-center text-on-surface-variant text-sm">
        © 2026 ToliarEvent. Fait avec ❤️ à Toliara.
      </div>
    </footer>
  );
}
