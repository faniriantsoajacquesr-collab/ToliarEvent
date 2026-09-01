import { useEffect, useState } from 'react';

import { Link, useLocation, useNavigate } from 'react-router-dom';

import LogoMark from './LogoMark';

import AuthModal from './AuthModal';

import ThemeToggle from './ThemeToggle';

import { useAuth } from '../contexts/AuthContext';

import {

  navigateToSection,

  usePublicNavHighlight,

  type PublicNavSection,

} from '../hooks/usePublicNav';

import { isAuthPage, isMarketingPage, isPublicShellPage } from '../utils/publicPages';



function navClass(isActive: boolean, themed: boolean) {

  if (themed) {

    return `text-sm font-medium cursor-pointer ${isActive ? 'landing-nav-active' : 'landing-nav-link'}`;

  }

  return `text-sm font-medium transition-colors cursor-pointer ${

    isActive ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'

  }`;

}



function mobileNavClass(isActive: boolean, themed: boolean) {

  if (themed) {

    return `font-landing-display text-2xl ${isActive ? 'landing-nav-active' : 'landing-nav-link'}`;

  }

  return `font-landing-display text-2xl ${isActive ? 'text-primary' : 'text-on-surface'}`;

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

  const [scrolled, setScrolled] = useState(false);

  const { isAuthModalOpen, setAuthModalOpen } = useAuth();

  const navigate = useNavigate();

  const { pathname } = useLocation();

  const activeFromScroll = usePublicNavHighlight();

  const activeSection = pendingSection ?? activeFromScroll;

  const themed = isPublicShellPage(pathname);

  const marketing = isMarketingPage(pathname);

  const auth = isAuthPage(pathname);

  const minimal = auth || pathname === '/badge-editor';



  useEffect(() => {

    if (pendingSection && activeFromScroll === pendingSection) {

      setPendingSection(null);

    }

  }, [activeFromScroll, pendingSection]);



  useEffect(() => {

    if (!themed) return;

    const onScroll = () => setScrolled(window.scrollY > 40);

    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);

  }, [themed]);



  const toggleMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  const closeMenu = () => setMobileMenuOpen(false);



  const handleNavClick = (section: PublicNavSection) => {

    setPendingSection(section);

    navigateToSection(section, navigate, pathname);

    closeMenu();

  };



  const headerClass = themed

    ? `landing-header ${scrolled || mobileMenuOpen || !marketing ? 'landing-header--scrolled' : 'landing-header--transparent'}`

    : 'fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 shadow-sm transition-all duration-300';



  const brandTextClass = themed

    ? 'font-landing-display text-lg font-bold landing-nav-brand'

    : 'font-headline-md text-headline-md font-bold text-primary';



  return (

    <>

      <header className={headerClass}>

        <nav className="flex items-center justify-between px-gutter py-4 max-w-container-max mx-auto">

          <Link

            to="/"

            className="flex items-center gap-2.5 cursor-pointer"

            onClick={(e) => {

              if (marketing) {

                e.preventDefault();

                handleNavClick('accueil');

              }

            }}

          >

            <LogoMark className="h-8 w-8 md:h-9 md:w-9" />

            <span className={brandTextClass}>ToliarEvent</span>

          </Link>



          {!minimal && (

            <div className="hidden md:flex items-center gap-8">

              {NAV_ITEMS.map((item) => (

                <button

                  key={item.id}

                  type="button"

                  onClick={() => handleNavClick(item.id)}

                  className={navClass(activeSection === item.id, themed)}

                >

                  {item.label}

                </button>

              ))}

            </div>

          )}



          <div className="flex items-center gap-2">

            {themed && <ThemeToggle className="hidden md:flex" />}

            {!auth && (

              <>

                <button

                  type="button"

                  className={`hidden md:block px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${

                    themed ? 'landing-nav-link' : 'text-on-surface-variant hover:text-primary'

                  }`}

                  onClick={() => (pathname === '/login' ? navigate('/login') : setAuthModalOpen(true, 'login'))}

                >

                  Connexion

                </button>

                <button

                  type="button"

                  className={

                    themed

                      ? 'landing-btn-primary !px-5 !py-2.5 !text-sm !rounded-full'

                      : 'bg-primary text-on-primary px-5 py-2 text-sm font-semibold rounded-xl shadow-sm hover:brightness-110 transition-all cursor-pointer'

                  }

                  onClick={() => (pathname === '/signup' ? navigate('/signup') : setAuthModalOpen(true, 'signup'))}

                >

                  S&apos;inscrire

                </button>

              </>

            )}

            {!minimal && (

              <button

                type="button"

                className={`md:hidden p-2 cursor-pointer ${themed ? 'landing-nav-link' : 'text-on-surface'}`}

                onClick={toggleMenu}

                aria-label="Ouvrir le menu"

              >

                <span className="material-symbols-outlined">menu</span>

              </button>

            )}

          </div>

        </nav>

      </header>



      {mobileMenuOpen && !minimal && (

        <div

          className={`fixed inset-0 z-[60] flex md:hidden flex-col items-center justify-center gap-8 px-gutter pt-20 backdrop-blur-xl ${

            themed ? 'bg-[var(--landing-bg)]/95' : 'bg-surface'

          }`}

        >

          <button

            type="button"

            className="absolute top-4 right-gutter p-2 cursor-pointer landing-nav-link"

            onClick={closeMenu}

            aria-label="Fermer le menu"

          >

            <span className="material-symbols-outlined text-[28px]">close</span>

          </button>

          {themed && <ThemeToggle />}

          {NAV_ITEMS.map((item) => (

            <button

              key={item.id}

              type="button"

              onClick={() => handleNavClick(item.id)}

              className={mobileNavClass(activeSection === item.id, themed)}

            >

              {item.label}

            </button>

          ))}

          <div className="mt-6 flex flex-col w-full max-w-xs gap-3">

            <button

              type="button"

              className="w-full py-3.5 border border-[var(--landing-border-strong)] landing-heading rounded-full font-medium cursor-pointer"

              onClick={() => {

                setAuthModalOpen(true, 'login');

                closeMenu();

              }}

            >

              Connexion

            </button>

            <button

              type="button"

              className="w-full py-3.5 landing-btn-primary !rounded-full justify-center"

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

