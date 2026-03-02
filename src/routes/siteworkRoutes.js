const express = require('express');
const router = express.Router();
const siteworkController = require('../controllers/siteworkController');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// ⚠️ Specific routes BEFORE param routes (:id)

// 📄 Download PDF
router.get('/download/all', verifyToken, authorize(['admin']), siteworkController.downloadAllReports);

// ➕ 1. Add Daily Site Report
router.post('/add', verifyToken, authorize(['admin', 'employee']), siteworkController.addReport);

// 📖 2. Get History by Project ID
router.get('/project/:projectId', verifyToken, authorize(['admin', 'employee']), siteworkController.getHistory);

// 📝 3. Edit / Update Report
router.put('/update/:id', verifyToken, authorize(['admin']), siteworkController.editReport);

// 🗑️ 4. Delete Report
router.delete('/delete/:id', verifyToken, authorize(['admin']), siteworkController.removeReport);

module.exports = router;