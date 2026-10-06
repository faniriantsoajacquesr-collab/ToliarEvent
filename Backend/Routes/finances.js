const router = require('express').Router();
const controller = require('../Controllers/financesController');

router.get('/transactions-categories', controller.listCategories);
router.post('/transactions-categories', controller.createCategory);
router.get('/transactions', controller.listTransactions);
router.post('/transactions', controller.createTransaction);
router.put('/transactions/:id', controller.updateTransaction);
router.delete('/transactions/:id', controller.deleteTransaction);

module.exports = router;
