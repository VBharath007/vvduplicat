const express = require("express");
const router = express.Router();
const advanceController = require("./advance.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

router.post("/", isAdmin, advanceController.createAdvance);
router.get("/", isAdmin, advanceController.getAdvances);
router.get("/project/:projectNo", isAdmin, advanceController.getAdvances);
router.put("/:id", isAdmin, advanceController.updateAdvance);
router.delete("/:id", isAdmin, advanceController.deleteAdvance);

module.exports = router;
