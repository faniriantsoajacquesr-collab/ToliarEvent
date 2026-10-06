const router = require('express').Router();
const { organizationAccessMiddleware } = require('../utils/organizationAccess');

router.use(organizationAccessMiddleware);

// Preserve the /api/auth API prefix and full paths used by the access middleware.
router.use(require('./auth'));
router.use(require('./profiles'));
router.use(require('./skills'));
router.use(require('./organizations'));
router.use(require('./organizationMembers'));
router.use(require('./publications'));
router.use(require('./events'));
router.use(require('./eventStaff'));
router.use(require('./tickets'));
router.use(require('./ticketTypes'));
router.use(require('./finances'));
router.use(require('./tasks'));
router.use(require('./orders'));
router.use(require('./papi'));
router.use(require('./administration'));
router.use(require('./diagnostics'));

module.exports = router;
