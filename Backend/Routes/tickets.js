const router = require('express').Router();
const controller = require('../Controllers/ticketsController');

router.post('/generate-tickets-async', controller.generateTicketsAsync);
router.post('/generate-tickets', controller.generateTickets);
router.get('/tickets', controller.listTickets);
router.post('/tickets/bulk-delete', controller.bulkDelete);
router.post('/tickets/restore-printed', controller.restorePrinted);
router.post('/tickets/bulk-update-status', controller.bulkUpdateStatus);
router.post('/tickets/scan', controller.scanTicket);
router.get('/tickets/:id', controller.getTicket);
router.delete('/tickets/:id', controller.deleteTicket);
router.put('/tickets/:id', controller.updateTicket);

module.exports = router;
