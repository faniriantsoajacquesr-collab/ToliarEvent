const router = require('express').Router();
const controller = require('../Controllers/eventStaffController');

router.post('/apply-event', controller.applyToEvent);
router.post('/event-staff/bulk-action', controller.bulkAction);
router.post('/event-staff/:id/validate', controller.validateStaff);
router.delete('/event-staff/:id', controller.deleteStaff);
router.post('/event-staff/my/:id/retry', controller.retryApplication);
router.delete('/event-staff/my/:id', controller.deleteMyApplication);
router.get('/event-staff', controller.listStaff);
router.get('/my-event-application', controller.getMyEventApplication);
router.get('/my-applications', controller.listMyApplications);

module.exports = router;
