const express = require("express");
const router = express.Router();
const projectController = require("./project.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

const imageController = require("./image.controller");
const upload = require("../../middleware/upload.middleware");

// ─── IMPORTANT: Specific static routes MUST come before /:projectNo ──────────
// If /images or /work-history are placed after /:projectNo, Express will treat
// "images" and "work-history" as the :projectNo param value → wrong handler.

// Image routes (no :projectNo prefix)
router.get("/images", isAdmin, imageController.getAllImages);
router.get("/images/:imageId", isAdmin, imageController.getImageById);
router.delete("/images/:imageId", isAdmin, imageController.deleteImage);

// Work history route
router.get("/work-history/:projectNo", isAdmin, projectController.getWorkHistory);

// ─── Project CRUD ─────────────────────────────────────────────────────────────
router.post("/", isAdmin, projectController.createProject);
router.get("/", isAdmin, projectController.getAllProjects);

// These come after all static routes — /:projectNo is a wildcard
router.get("/:projectNo", isAdmin, projectController.getProjectByNo);
router.put("/:projectNo", isAdmin, projectController.updateProject);
router.delete("/:projectNo", isAdmin, projectController.deleteProject);

// Summary API — /:projectNo/summary is fine here (more specific path wins)
router.get("/:projectNo/summary", isAdmin, projectController.getProjectSummary);

// Image APIs with :projectNo prefix
router.post(
    "/:projectNo/images",
    isAdmin,
    upload.single("image"),
    imageController.uploadImage
);
router.get("/:projectNo/images", isAdmin, imageController.getProjectImages);

module.exports = router;