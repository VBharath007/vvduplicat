const express = require("express");
const router = express.Router();
const projectController = require("./project.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

router.post("/", isAdmin, projectController.createProject);
router.get("/", isAdmin, projectController.getAllProjects);
router.get("/:projectNo", isAdmin, projectController.getProjectByNo);
router.put("/:projectNo", isAdmin, projectController.updateProject);
router.delete("/:projectNo", isAdmin, projectController.deleteProject);

// Summary API
router.get("/:projectNo/summary", isAdmin, projectController.getProjectSummary);

// Image APIs
const imageController = require("./image.controller");
const upload = require("../../middleware/upload.middleware");

router.post(
    "/:projectNo/images",
    isAdmin,
    upload.single("image"),
    imageController.uploadImage
);

router.get(
    "/:projectNo/images",
    isAdmin,
    imageController.getProjectImages
);

router.get("/images", isAdmin, imageController.getAllImages); // Fetch all project images
router.get("/images/:imageId", isAdmin, imageController.getImageById); // Fetch single image metadata
router.delete("/images/:imageId", isAdmin, imageController.deleteImage);

router.get("/work-history/:projectNo", isAdmin, projectController.getWorkHistory);

module.exports = router;