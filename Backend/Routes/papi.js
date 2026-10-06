const router = require('express').Router();
const controller = require('../Controllers/papiController');
router.post('/events/:id/checkout', controller.create);
router.get('/checkouts/:id', controller.status);
router.post('/checkouts/:id/pay', controller.pay);
module.exports = router;
