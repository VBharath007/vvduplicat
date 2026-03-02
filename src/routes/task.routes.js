const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// All task routes require authentication
router.post('/submit', verifyToken, authorize(['admin', 'employee']), taskController.addTask);
router.get('/history', verifyToken, authorize(['admin', 'employee']), taskController.getHistory);
router.put('/update/:id', verifyToken, authorize(['admin', 'employee']), taskController.editTask);
router.delete('/delete/:id', verifyToken, authorize(['admin', 'employee']), taskController.removeTask);

module.exports = router;