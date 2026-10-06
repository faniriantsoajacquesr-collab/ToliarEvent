const router = require('express').Router();
const controller = require('../Controllers/organizationMembersController');

router.get('/organization-members', controller.listMembers);
router.post('/organization-members/bulk-action', controller.bulkAction);
router.patch('/organization-members/:id', controller.updateMember);
router.delete('/organization-members/:id', controller.deleteMember);

module.exports = router;
