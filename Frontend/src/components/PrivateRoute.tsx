import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppShellSkeleton } from './skeleton';

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
    return <AppShellSkeleton />;
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
