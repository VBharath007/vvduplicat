const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const multer = require('multer');
const { verifyToken } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");

// Multier setup for future image uploads
const upload = multer({ storage: multer.memoryStorage() });

// ➕ 1. Create Project
router.post('/', verifyToken, authorize(["admin"]), upload.array('siteImages', 10), projectController.addProject);

// 📖 2. Get All Projects (List display panradhuku)
router.get('/', verifyToken, authorize(["admin"]), projectController.getProjects);

// � 3. DOWNLOAD PROJECT INVOICE — ⚠️ Specific routes MUST come before /:id wildcard!
router.get('/download-invoice/:id', verifyToken, authorize(["admin"]), projectController.downloadProjectInvoice);

// � 4. Get Single Project Details
router.get('/:id', verifyToken, authorize(["admin"]), projectController.getProject);

// � 5. Update Project Details
router.put('/:id', verifyToken, authorize(["admin"]), projectController.patchProject);

// �️ 6. Delete Project
router.delete('/:id', verifyToken, authorize(["admin"]), projectController.removeProject);

module.exports = router;