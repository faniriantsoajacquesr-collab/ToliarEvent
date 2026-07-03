import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getPageTitle, setDocumentTitle } from '../utils/pageTitles';

export default function PageTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    setDocumentTitle(getPageTitle(pathname));
  }, [pathname]);

  return null;
}
