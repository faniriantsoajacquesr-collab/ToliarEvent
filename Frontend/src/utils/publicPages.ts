/** Marketing pages with full hero + landing background */
export function isMarketingPage(pathname: string): boolean {
  return pathname === '/' || pathname === '/evenements';
}

/** All public shell pages (TopBar + Footer + themed tokens) */
export function isPublicShellPage(pathname: string): boolean {
  return (
    isMarketingPage(pathname) ||
    pathname.startsWith('/evenements/') ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/auth/') ||
    pathname === '/badge-editor'
  );
}

/** @deprecated use isMarketingPage */
export function isThemedPublicPage(pathname: string): boolean {
  return isMarketingPage(pathname);
}

export function isAuthPage(pathname: string): boolean {
  return pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/');
}
