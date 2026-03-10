const express = require("express");
const router = express.Router();
const projectController = require("./project.controller");

router.post("/", projectController.createProject);
router.get("/", projectController.getAllProjects);
router.get("/:projectNo", projectController.getProjectByNo);

router.put("/:projectNo", projectController.updateProject);
router.delete("/:projectNo", projectController.deleteProject);

// Summary API
router.get("/:projectNo/summary", projectController.getProjectSummary);

// Image APIs
const imageController = require("./image.controller");
const upload = require("../../middleware/upload.middleware");

router.post("/:projectNo/images", upload.single("image"), imageController.uploadImage);
router.get("/:projectNo/images", imageController.getProjectImages);
router.delete("/images/:imageId", imageController.deleteImage);

router.get(
    "/work-history/:projectNo",
    projectController.getWorkHistory
);

module.exports = router;