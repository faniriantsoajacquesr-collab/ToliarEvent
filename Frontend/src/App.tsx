import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import PrivateRoute from './components/PrivateRoute';

// Auth Pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import OrganizationChoicePage from './pages/OrganizationChoicePage';
import OrganizationPendingPage from './pages/OrganizationPendingPage';

// Main Pages
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import TicketBadgeEditor from './pages/TicketBadgeEditor';
import PublicationBuilder from './pages/PublicationBuilder';
import EventListPage from './pages/EventListPage';
import EventLandingPage from './pages/EventLandingPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PublicLayout from './components/PublicLayout';
import LegalLayout from './components/LegalLayout';
import PageTitle from './components/PageTitle';
import { normalizeHash } from './hooks/usePublicNav';

const LEGACY_DASHBOARD_PATHS: Record<string, string> = {
  '/dashboard': '/events',
  '/dashboard/events': '/events',
  '/dashboard/staff': '/staff',
  '/dashboard/tickets': '/tickets',
  '/dashboard/commandes': '/commandes',
  '/dashboard/planning': '/planning',
  '/dashboard/finance': '/finance',
  '/dashboard/publication': '/publication',
};

function LegacyDashboardRedirect() {
  const { pathname } = useLocation();
  return <Navigate to={LEGACY_DASHBOARD_PATHS[pathname] ?? '/events'} replace />;
}

function LegacyPublicEventRedirect() {
  const { eventId } = useParams();
  return <Navigate to={`/evenements/${eventId}`} replace />;
}

function HashRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const handle = () => {
      const hash = window.location.hash;
      if (!hash) return;

      if (hash === '#events') {
        navigate('/evenements', { replace: true });
        return;
      }

      const section = normalizeHash(hash);
      if (section && section !== 'evenements') {
        navigate({ pathname: '/', hash: `#${section}` }, { replace: true });
      }
    };
    handle();
    window.addEventListener('hashchange', handle);
    return () => window.removeEventListener('hashchange', handle);
  }, [navigate]);
  return null;
}

const dashboardElement = (
  <PrivateRoute requireProfile={true}>
    <Dashboard />
  </PrivateRoute>
);

const adminDashboardElement = (
  <PrivateRoute requireProfile={true} requireAdmin>
    <Dashboard />
  </PrivateRoute>
);

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <Router>
        <PageTitle />
        <HashRedirect />
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/evenements" element={<EventListPage />} />
            <Route path="/evenements/:eventId" element={<EventLandingPage />} />
            <Route path="/a-propos" element={<Navigate to="/#a-propos" replace />} />
            <Route path="/contact" element={<Navigate to="/#contact" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/events-list" element={<Navigate to="/evenements" replace />} />
            <Route path="/events/:eventId" element={<LegacyPublicEventRedirect />} />
            <Route path="/badge-editor" element={<TicketBadgeEditor />} />
          </Route>

          <Route element={<LegalLayout />}>
            <Route path="/confidentialite" element={<PrivacyPolicyPage />} />
            <Route path="/cgu" element={<TermsOfServicePage />} />
          </Route>

          {/* Auth Routes */}
          <Route
            path="/complete-profile"
            element={
              <PrivateRoute requireProfile={false}>
                <CompleteProfilePage />
              </PrivateRoute>
            }
          />

          <Route
            path="/organization-choice"
            element={
              <PrivateRoute requireProfile={true} requireOrganization={false}>
                <OrganizationChoicePage />
              </PrivateRoute>
            }
          />

          <Route
            path="/organization-pending"
            element={
              <PrivateRoute requireProfile={true} requireOrganization={true} allowPendingOrganization>
                <OrganizationPendingPage />
              </PrivateRoute>
            }
          />

          {/* Protected App Routes */}
          <Route path="/events" element={dashboardElement} />
          <Route path="/staff" element={dashboardElement} />
          <Route path="/tickets" element={dashboardElement} />
          <Route path="/commandes" element={adminDashboardElement} />
          <Route path="/planning" element={dashboardElement} />
          <Route path="/finance" element={dashboardElement} />
          <Route path="/publication" element={adminDashboardElement} />

          <Route path="/dashboard" element={<LegacyDashboardRedirect />} />
          <Route path="/dashboard/*" element={<LegacyDashboardRedirect />} />

          <Route
            path="/publication-builder"
            element={
              <PrivateRoute requireProfile={true} requireAdmin>
                <PublicationBuilder />
              </PrivateRoute>
            }
          />
          <Route
            path="/publication-builder/:eventId"
            element={
              <PrivateRoute requireProfile={true} requireAdmin>
                <PublicationBuilder />
              </PrivateRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
