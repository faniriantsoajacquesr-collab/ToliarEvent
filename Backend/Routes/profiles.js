const router = require('express').Router();
const controller = require('../Controllers/profilesController');

router.post('/create-profile', controller.createProfile);
router.get('/check-profile', controller.checkProfile);
router.post('/profile-skills', controller.setProfileSkills);

module.exports = router;
