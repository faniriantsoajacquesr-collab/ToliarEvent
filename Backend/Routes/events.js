const router = require('express').Router();
const controller = require('../Controllers/eventsController');

router.delete('/events/:id', controller.deleteEvent);
router.get('/events', controller.listEvents);
router.get('/event-categories', controller.listCategories);
router.get('/events/:id', controller.getEvent);
router.put('/events/:id', controller.updateEvent);
router.post('/create-event', controller.createEvent);

module.exports = router;
