const router = require('express').Router();
const controller = require('../Controllers/organizationsController');

router.post('/create-organization', controller.createOrganization);
router.post('/join-organization', controller.joinOrganization);
router.post('/organization-skills', controller.setOrganizationSkills);
router.get('/my-organization', controller.getMyOrganization);

module.exports = router;
