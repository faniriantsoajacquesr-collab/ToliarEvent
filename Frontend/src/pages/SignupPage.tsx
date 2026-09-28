import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthShell from '../components/AuthShell';
import EarlyAccessNotice from '../components/EarlyAccessNotice';

export default function SignupPage() {
  const { setAuthModalOpen } = useAuth();
  useEffect(() => {
    setAuthModalOpen(true, 'signup');
    // Open once when navigating directly to the former registration page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <AuthShell title="Demander un accès à ToliarEvent Pro" subtitle="ToliarEvent" footer={<Link to="/login" className="text-primary">Se connecter</Link>}>
      <EarlyAccessNotice />
    </AuthShell>
  );
}
