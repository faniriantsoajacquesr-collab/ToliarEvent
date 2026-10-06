import { Link, useLocation } from 'react-router-dom';

export default function RecentCheckoutLink() {
  const { pathname } = useLocation();
  let path = '';
  try { path = localStorage.getItem('papi-last-checkout') || ''; } catch { /* optional */ }
  if (pathname.startsWith('/paiement/') || !/^\/paiement\/[a-f0-9-]{36}#token=[a-f0-9]{64}$/.test(path)) return null;
  return <div className="px-4 pt-3 text-center"><Link to={path} className="inline-block rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">Retrouver ma dernière commande</Link></div>;
}
