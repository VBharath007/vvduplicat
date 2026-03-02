const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// All approval routes require admin authentication
router.post('/add', verifyToken, authorize(['admin']), approvalController.createApproval);
router.get('/list', verifyToken, authorize(['admin']), approvalController.getAllApprovals);
router.get('/:id', verifyToken, authorize(['admin']), approvalController.getOneApproval);
router.put('/update-status/:id', verifyToken, authorize(['admin']), approvalController.updateStatus);
router.delete('/delete/:id', verifyToken, authorize(['admin']), approvalController.deleteApproval);
router.get('/download/:id', verifyToken, authorize(['admin']), approvalController.downloadCaseFile);

module.exports = router;