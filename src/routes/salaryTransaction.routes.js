const express = require('express');
const router = express.Router();
const salaryTxnController = require('../controllers/salaryTransaction.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// All routes require admin authentication
// 📊 1. Get full salary summary for an employee
router.get('/summary/:empID', verifyToken, authorize(['admin']), salaryTxnController.getSalarySummary);

// ➕ 2. Record an advance payment
router.post('/advance/:empID', verifyToken, authorize(['admin']), salaryTxnController.addAdvance);

// 💰 3. Record final payment (clears balance)
router.post('/payment/:empID', verifyToken, authorize(['admin']), salaryTxnController.addPayment);

module.exports = router;
