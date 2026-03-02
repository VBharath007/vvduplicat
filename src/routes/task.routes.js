const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');

router.post('/submit', taskController.addTask);
router.get('/history', taskController.getHistory);
router.put('/update/:id', taskController.editTask);
router.delete('/delete/:id', taskController.removeTask);

module.exports = router;