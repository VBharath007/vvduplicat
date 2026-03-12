const express = require("express");
const router = express.Router();
const workController = require("./work.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

// IMPORTANT: /by-date must be before /:workId to avoid route conflict
router.get("/by-date", isAdmin, workController.getWorkByDate);

router.post("/", isAdmin, workController.createWork);
router.get("/", isAdmin, workController.getWorks);
router.get("/:workId", isAdmin, workController.getWorkById);
router.put("/:workId", isAdmin, workController.updateWork);
router.delete("/:workId", isAdmin, workController.deleteWork);

module.exports = router;