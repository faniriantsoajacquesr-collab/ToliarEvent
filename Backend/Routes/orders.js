const router = require('express').Router();
const controller = require('../Controllers/ordersController');

router.get('/payment-methods', controller.listPaymentMethods);
router.post('/events/:id/purchase-ticket', controller.purchaseTicket);
router.get('/events/:eventId/orders', controller.listEventOrders);
router.post('/orders/bulk-devalidate', controller.bulkDevalidate);
router.post('/orders/bulk-validate', controller.bulkValidate);
router.post('/orders/bulk-delete', controller.bulkDelete);
router.post('/orders/:id/validate', controller.validateOrder);
router.post('/orders/:id/devalidate', controller.devalidateOrder);
router.delete('/orders/:id', controller.deleteOrder);

module.exports = router;
