import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
  requireProfile?: boolean;
  requireOrganization?: boolean;
  requireAdmin?: boolean;
  allowPendingOrganization?: boolean;
}

export default function PrivateRoute({
  children,
  requireProfile = true,
  requireOrganization = true,
  requireAdmin = false,
  allowPendingOrganization = false,
}: PrivateRouteProps) {
  const {
    isAuthenticated,
    hasProfile,
    hasOrganization,
    organizationStatus,
    isLoading,
    user,
  } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
        <div className="flex flex-col items-center gap-md">
          <div className="w-16 h-16 border-4 border-outline-variant border-t-primary rounded-full animate-spin"></div>
          <p className="text-label-md text-on-surface-variant">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requireProfile && !hasProfile) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (!requireProfile && hasProfile && requireOrganization && !hasOrganization) {
    return <Navigate to="/organization-choice" replace />;
  }

  if (requireOrganization && hasProfile && !hasOrganization) {
    return <Navigate to="/organization-choice" replace />;
  }

  const isOrgBlocked = hasOrganization && (organizationStatus === 'pending' || organizationStatus === 'rejected');

  if (isOrgBlocked && !allowPendingOrganization) {
    return <Navigate to="/organization-pending" replace />;
  }

  if (allowPendingOrganization && hasOrganization && organizationStatus === 'active') {
    return <Navigate to="/events" replace />;
  }

  if (requireAdmin && user?.role?.toString().toLowerCase() !== 'admin') {
    return <Navigate to="/events" replace />;
  }

  return <>{children}</>;
}
