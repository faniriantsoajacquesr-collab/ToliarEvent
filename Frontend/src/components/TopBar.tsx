import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LogoMark from './LogoMark';
import AuthModal from './AuthModal';
import { useAuth } from '../contexts/AuthContext';
import {
  navigateToSection,
  usePublicNavHighlight,
  type PublicNavSection,
} from '../hooks/usePublicNav';

function navClass(isActive: boolean) {
  return `font-body-md text-body-md transition-colors ${
    isActive
      ? 'text-primary font-bold border-b-2 border-primary'
      : 'text-on-surface-variant hover:text-primary'
  }`;
}

function mobileNavClass(isActive: boolean) {
  return `font-headline-lg text-headline-lg ${isActive ? 'text-primary font-bold' : ''}`;
}

type NavItem = {
  id: PublicNavSection;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'evenements', label: 'Événements' },
  { id: 'a-propos', label: 'À propos' },
  { id: 'contact', label: 'Contact' },
];

export default function TopBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingSection, setPendingSection] = useState<PublicNavSection | null>(null);
  const { isAuthModalOpen, setAuthModalOpen } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeFromScroll = usePublicNavHighlight();
  const activeSection = pendingSection ?? activeFromScroll;

  useEffect(() => {
    if (pendingSection && activeFromScroll === pendingSection) {
      setPendingSection(null);
    }
  }, [activeFromScroll, pendingSection]);

  const toggleMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMenu = () => setMobileMenuOpen(false);

  const handleNavClick = (section: PublicNavSection) => {
    setPendingSection(section);
    navigateToSection(section, navigate, pathname);
    closeMenu();
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 shadow-sm transition-all duration-300">
        <nav className="flex items-center justify-between px-gutter py-md max-w-container-max mx-auto">
          <Link
            to="/"
            className="flex items-center gap-sm"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('accueil');
            }}
          >
            <LogoMark className="h-8 w-8 md:h-10 md:w-10" />
            <span className="font-headline-md text-headline-md font-bold text-primary">
              ToliarEvent
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-lg">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={navClass(activeSection === item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-sm">
            <button
              className="hidden md:block px-md py-sm font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high/50 transition-all rounded-lg active:scale-95"
              onClick={() => setAuthModalOpen(true, 'login')}
            >
              Connexion
            </button>
            <button
              className="bg-primary text-on-primary px-lg py-sm font-label-md text-label-md font-bold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
              onClick={() => setAuthModalOpen(true, 'signup')}
            >
              S'inscrire
            </button>
            <button className="md:hidden p-sm text-on-surface" onClick={toggleMenu}>
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </nav>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-surface flex md:hidden flex-col items-center justify-center gap-lg px-gutter pt-20">
          <button className="absolute top-md right-gutter" onClick={closeMenu}>
            <span className="material-symbols-outlined text-[32px]">close</span>
          </button>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={mobileNavClass(activeSection === item.id)}
            >
              {item.label}
            </button>
          ))}
          <div className="mt-xl flex flex-col w-full gap-md">
            <button
              className="w-full py-md border border-outline text-on-surface rounded-xl"
              onClick={() => {
                setAuthModalOpen(true, 'login');
                closeMenu();
              }}
            >
              Connexion
            </button>
            <button
              className="w-full py-md bg-primary text-on-primary rounded-xl font-bold"
              onClick={() => {
                setAuthModalOpen(true, 'signup');
                closeMenu();
              }}
            >
              Créer un compte
            </button>
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
