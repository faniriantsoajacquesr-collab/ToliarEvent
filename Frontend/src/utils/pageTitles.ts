const APP_NAME = 'ToliarEvent';

const ROUTE_TITLES: Record<string, string> = {
  '/': `Événements à Toliara | ${APP_NAME}`,
  '/evenements': `Événements | ${APP_NAME}`,
  '/login': `Connexion | ${APP_NAME}`,
  '/signup': `Inscription | ${APP_NAME}`,
  '/complete-profile': `Compléter le profil | ${APP_NAME}`,
  '/organization-choice': `Organisation | ${APP_NAME}`,
  '/organization-pending': `Organisation en attente | ${APP_NAME}`,
  '/events': `Gestion des événements | ${APP_NAME}`,
  '/staff': `Staff | ${APP_NAME}`,
  '/tickets': `Billets | ${APP_NAME}`,
  '/commandes': `Commandes | ${APP_NAME}`,
  '/planning': `Planning | ${APP_NAME}`,
  '/finance': `Finance | ${APP_NAME}`,
  '/publication': `Publication | ${APP_NAME}`,
  '/publication-builder': `Éditeur de publication | ${APP_NAME}`,
  '/badge-editor': `Éditeur de badges | ${APP_NAME}`,
  '/confidentialite': `Politique de confidentialité | ${APP_NAME}`,
  '/cgu': `Conditions d'utilisation | ${APP_NAME}`,
};

export function getPageTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname];
  }

  if (pathname.startsWith('/evenements/')) {
    return `Événement | ${APP_NAME}`;
  }

  if (pathname.startsWith('/publication-builder/')) {
    return `Éditeur de publication | ${APP_NAME}`;
  }

  return `Événements à Toliara | ${APP_NAME}`;
}

export function setDocumentTitle(title: string): void {
  document.title = title;
}
