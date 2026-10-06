const router = require('express').Router();
const controller = require('../Controllers/diagnosticsController');

router.get('/whoami', controller.whoami);
router.get('/debug/tickets', controller.inspectTickets);

module.exports = router;
