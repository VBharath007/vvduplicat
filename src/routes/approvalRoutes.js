/*
const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');

// --- CRUD Operations ---
router.post('/add', approvalController.createApprovalEntry); // Create
router.get('/list', approvalController.getAllApprovals);      // Read All
router.get('/:id', approvalController.getOneApproval);       // Read One
router.put('/update/:id', approvalController.updateApprovalStatus); // Update Status
router.delete('/delete/:id', approvalController.deleteApproval); // Delete

// --- Download Option ---
router.get('/download/:id', approvalController.downloadCaseFile);

module.exports = router;
*/

const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');

// 🔴 Error FIX: Controller function name correct-aa match aaganum
// Controller-la 'createApproval' nu irundha, ingayum 'createApproval' dhaan irukanum

router.post('/add', approvalController.createApproval); // ✅ Corrected

router.get('/list', approvalController.getAllApprovals); 

router.get('/:id', approvalController.getOneApproval); 

router.put('/update-status/:id', approvalController.updateStatus); // ✅ Controller-la 'updateStatus' nu irukku

router.delete('/delete/:id', approvalController.deleteApproval);

router.get('/download/:id', approvalController.downloadCaseFile);

module.exports = router;