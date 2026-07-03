export type OrganizationStatus = 'pending' | 'active' | 'rejected' | null;

export function resolveAppEntryPath(options: {
  hasProfile: boolean;
  hasOrganization: boolean;
  organizationStatus: OrganizationStatus;
}): string {
  if (!options.hasProfile) return '/complete-profile';
  if (!options.hasOrganization) return '/organization-choice';
  if (options.organizationStatus === 'pending' || options.organizationStatus === 'rejected') {
    return '/organization-pending';
  }
  return '/events';
}
