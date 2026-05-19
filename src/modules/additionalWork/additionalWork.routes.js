const express = require("express");
const router = express.Router();
const additionalWorkController = require("./additionalWork.controller");
const { verifyToken, isAdmin } = require("../../middleware/auth.middleware");

// ─── Additional Work Payment CRUD ───

// POST /api/additional-works
router.post("/", [verifyToken, isAdmin], additionalWorkController.createAdditionalWork);

// GET /api/additional-works?projectNo=PRO001
router.get("/", [verifyToken, isAdmin], additionalWorkController.getAllAdditionalWorks);

// GET /api/additional-works/:id
router.get("/:id", [verifyToken, isAdmin], additionalWorkController.getAdditionalWorkById);

// PUT /api/additional-works/:id
router.put("/:id", [verifyToken, isAdmin], additionalWorkController.updateAdditionalWork);

// DELETE /api/additional-works/:id
router.delete("/:id", [verifyToken, isAdmin], additionalWorkController.deleteAdditionalWork);

module.exports = router;
