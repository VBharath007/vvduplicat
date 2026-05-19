const express = require("express");
const router = express.Router();
const extraWorkController = require("./extraWork.controller");
const { verifyToken, isAdmin } = require("../../middleware/auth.middleware");

// ─── Extra Work / Notes CRUD ───

// POST /api/extra-works
router.post("/", [verifyToken, isAdmin], extraWorkController.createExtraWork);

// GET /api/extra-works?projectNo=PRO001
router.get("/", [verifyToken, isAdmin], extraWorkController.getAllExtraWorks);

// GET /api/extra-works/:id
router.get("/:id", [verifyToken, isAdmin], extraWorkController.getExtraWorkById);

// PUT /api/extra-works/:id
router.put("/:id", [verifyToken, isAdmin], extraWorkController.updateExtraWork);

// DELETE /api/extra-works/:id
router.delete("/:id", [verifyToken, isAdmin], extraWorkController.deleteExtraWork);

module.exports = router;
