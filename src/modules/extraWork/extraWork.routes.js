const express = require("express");
const router = express.Router();
const extraWorkController = require("./extraWork.controller");
const { isAdmin } = require("../../middleware/auth.middleware");

// ─── Extra Work / Notes CRUD ───

// POST /api/extra-works
router.post("/", isAdmin, extraWorkController.createExtraWork);

// GET /api/extra-works?projectNo=PRO001
router.get("/", isAdmin, extraWorkController.getAllExtraWorks);

// GET /api/extra-works/:id
router.get("/:id", isAdmin, extraWorkController.getExtraWorkById);

// PUT /api/extra-works/:id
router.put("/:id", isAdmin, extraWorkController.updateExtraWork);

// DELETE /api/extra-works/:id
router.delete("/:id", isAdmin, extraWorkController.deleteExtraWork);

module.exports = router;
