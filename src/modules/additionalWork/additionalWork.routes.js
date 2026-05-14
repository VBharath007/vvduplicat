const express = require("express");
const router = express.Router();
const additionalWorkController = require("./additionalWork.controller");
const { isAdmin } = require("../../middleware/auth.middleware");

// ─── Additional Work Payment CRUD ───

// POST /api/additional-works
router.post("/", isAdmin, additionalWorkController.createAdditionalWork);

// GET /api/additional-works?projectNo=PRO001
router.get("/", isAdmin, additionalWorkController.getAllAdditionalWorks);

// GET /api/additional-works/:id
router.get("/:id", isAdmin, additionalWorkController.getAdditionalWorkById);

// PUT /api/additional-works/:id
router.put("/:id", isAdmin, additionalWorkController.updateAdditionalWork);

// DELETE /api/additional-works/:id
router.delete("/:id", isAdmin, additionalWorkController.deleteAdditionalWork);

module.exports = router;
