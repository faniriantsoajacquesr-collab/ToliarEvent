const router = require('express').Router();
const controller = require('../Controllers/administrationController');

router.get('/admin/organizations/pending', controller.listPendingOrganizations);
router.patch('/admin/organizations/:id/status', controller.updateOrganizationStatus);

module.exports = router;
