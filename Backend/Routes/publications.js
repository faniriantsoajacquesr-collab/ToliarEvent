const router = require('express').Router();
const controller = require('../Controllers/publicationsController');

router.get('/events/landing-pages', controller.listLandingPages);
router.get('/events/public', controller.listPublicEvents);
router.put('/events/:id/landing-page/publish', controller.publishLandingPage);
router.get('/events/:id/landing-page', controller.getLandingPage);
router.get('/events/:id/public-landing-page', controller.getPublicLandingPage);
router.post('/events/:id/landing-page/upload-image', controller.uploadImage);
router.put('/events/:id/landing-page', controller.saveLandingPage);

module.exports = router;
