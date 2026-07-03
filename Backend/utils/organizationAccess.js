const supabase = require('./supabase');

const ALLOWED_WITHOUT_ACTIVE_ORG = new Set([
  '/signup',
  '/login',
  '/logout',
  '/confirm-email',
  '/refresh-token',
  '/forgot-password',
  '/reset-password',
  '/check-profile',
  '/create-profile',
  '/skills',
  '/profile-skills',
  '/create-organization',
  '/join-organization',
  '/user',
]);

function isPublicPath(path) {
  if (path === '/events/public') return true;
  if (/^\/events\/[^/]+\/public-landing-page$/.test(path)) return true;
  return false;
}

function isPlatformAdmin(email) {
  const admins = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes((email || '').toLowerCase());
}

async function getOrganizationStatusForUser(profileId) {
  const dbAdmin = supabase.admin || supabase;
  const { data: memberRows } = await dbAdmin
    .from('organization_members')
    .select('organization_id, organizations(status)')
    .eq('profile_id', profileId)
    .limit(1)
    .maybeSingle();

  if (!memberRows) {
    return { hasOrganization: false, status: null };
  }

  return {
    hasOrganization: true,
    status: memberRows.organizations?.status || 'active',
    organizationId: memberRows.organization_id,
  };
}

async function organizationAccessMiddleware(req, res, next) {
  const path = req.path;

  if (isPublicPath(path)) return next();
  if (ALLOWED_WITHOUT_ACTIVE_ORG.has(path)) return next();
  if (path.startsWith('/admin/organizations')) return next();

  const access_token = req.headers.authorization?.split('Bearer ')[1];
  if (!access_token) return next();

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return next();

    const { hasOrganization, status } = await getOrganizationStatusForUser(authData.user.id);
    if (!hasOrganization) return next();

    if (status === 'pending') {
      return res.status(403).json({
        success: false,
        error: 'ORGANIZATION_PENDING',
        message: 'Votre organisation est en attente de validation par un administrateur.',
      });
    }

    if (status === 'rejected') {
      return res.status(403).json({
        success: false,
        error: 'ORGANIZATION_REJECTED',
        message: 'Votre demande d\'organisation a été refusée.',
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  organizationAccessMiddleware,
  isPlatformAdmin,
  getOrganizationStatusForUser,
};
