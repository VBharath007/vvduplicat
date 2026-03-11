const express = require("express");
const router = express.Router();
const workController = require("./work.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

router.post("/", isAdmin, workController.createWork);
router.get("/", isAdmin, workController.getWorks);
router.get("/:workId", isAdmin, workController.getWorkById);
router.put("/:workId", isAdmin, workController.updateWork);
router.delete("/:workId", isAdmin, workController.deleteWork);

module.exports = router;
