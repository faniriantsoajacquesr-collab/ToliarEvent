const router = require('express').Router();
const controller = require('../Controllers/tasksController');

router.get('/tasks', controller.listTasks);
router.post('/tasks', controller.createTask);
router.put('/tasks/:id', controller.updateTask);
router.delete('/tasks/:id', controller.deleteTask);

module.exports = router;
