const express = require("express");
const router = express.Router();
const advanceController = require("./advance.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

router.post("/", isAdmin, advanceController.createAdvance);
router.get("/", isAdmin, advanceController.getAdvances);

module.exports = router;
