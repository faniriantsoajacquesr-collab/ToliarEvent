const router = require('express').Router();
const controller = require('../Controllers/authController');

router.post('/signup', controller.signup);
router.post('/login', controller.login);
router.post('/logout', controller.logout);
router.post('/confirm-email', controller.confirmEmail);
router.post('/refresh-token', controller.refreshToken);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);
router.get('/user', controller.getUser);

module.exports = router;
