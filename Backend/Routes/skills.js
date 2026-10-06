const router = require('express').Router();
const controller = require('../Controllers/skillsController');

router.get('/skills', controller.listSkills);

module.exports = router;
