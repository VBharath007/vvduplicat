const express = require('express');
const router = express.Router();
const siteworkController = require('../controllers/siteworkController');

// ⚠️  Specific routes BEFORE param routes (:id)

// 📄 Download PDF (specific — must come before /:id)
router.get('/download/all', siteworkController.downloadAllReports);

// ➕ 1. Add Daily Site Report
router.post('/add', siteworkController.addReport);

// 📖 2. Get History by Project ID
router.get('/project/:projectId', siteworkController.getHistory);

// 📝 3. Edit / Update Report
router.put('/update/:id', siteworkController.editReport);

// 🗑️ 4. Delete Report
router.delete('/delete/:id', siteworkController.removeReport);

module.exports = router;