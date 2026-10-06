const router = require('express').Router();
const controller = require('../Controllers/ticketTypesController');

router.get('/ticket-type', controller.listTypes);
router.post('/ticket-type', controller.createType);
router.put('/ticket-type/:id', controller.updateType);
router.delete('/ticket-type/:id', controller.deleteType);
router.put('/events/:id/ticket-types-active', controller.setActiveTypes);

module.exports = router;
