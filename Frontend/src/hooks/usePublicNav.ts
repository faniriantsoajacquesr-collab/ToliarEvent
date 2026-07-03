import { useEffect, useState } from 'react';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';

export type PublicNavSection = 'accueil' | 'a-propos' | 'contact' | 'evenements';

const HOME_SECTIONS: PublicNavSection[] = ['accueil', 'a-propos', 'contact'];

// Aligné sur scroll-mt-28 (112px) + hauteur topbar
const MARKER_LINE = 130;

const HASH_ALIASES: Record<string, PublicNavSection> = {
  home: 'accueil',
  about: 'a-propos',
  accueil: 'accueil',
  'a-propos': 'a-propos',
  contact: 'contact',
};

export function normalizeHash(hash: string): PublicNavSection | null {
  const key = hash.replace('#', '');
  return HASH_ALIASES[key] ?? null;
}

export function scrollToSection(sectionId: PublicNavSection) {
  if (sectionId === 'evenements') return;
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth' });
  [300, 600, 900].forEach((ms) => window.setTimeout(() => window.dispatchEvent(new Event('scroll')), ms));
}

export function navigateToSection(
  section: PublicNavSection,
  navigate: NavigateFunction,
  pathname: string,
) {
  if (section === 'evenements') {
    navigate('/evenements');
    return;
  }

  const go = () => scrollToSection(section);

  if (pathname !== '/') {
    navigate({ pathname: '/', hash: `#${section}` });
    setTimeout(go, 150);
  } else {
    window.history.replaceState(null, '', `/#${section}`);
    go();
  }
}

export function detectActiveSection(): PublicNavSection {
  // 1. Section dont la zone englobe la ligne de repère (meilleur pour les longues sections)
  for (let i = HOME_SECTIONS.length - 1; i >= 0; i--) {
    const id = HOME_SECTIONS[i];
    const el = document.getElementById(id);
    if (!el) continue;

    const { top, bottom } = el.getBoundingClientRect();
    if (top <= MARKER_LINE && bottom > MARKER_LINE) {
      return id;
    }
  }

  // 2. Fallback : dernière section dont le haut est passé au-dessus de la ligne
  let current: PublicNavSection = 'accueil';
  for (const id of HOME_SECTIONS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.getBoundingClientRect().top <= MARKER_LINE) {
      current = id;
    }
  }

  return current;
}

export function usePublicNavHighlight(): PublicNavSection {
  const { pathname } = useLocation();
  const [active, setActive] = useState<PublicNavSection>(
    pathname.startsWith('/evenements') ? 'evenements' : 'accueil',
  );

  useEffect(() => {
    if (pathname.startsWith('/evenements')) {
      setActive('evenements');
      return;
    }

    if (pathname !== '/') return;

    const update = () => setActive(detectActiveSection());

    const timer = window.setTimeout(update, 50);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [pathname]);

  return active;
}
