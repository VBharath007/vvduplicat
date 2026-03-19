const express = require("express");
const router = express.Router();
const labourController = require("./labour.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

// ─── Head Labour Master CRUD ────────────────────────────────────────────────
router.post("/master", isAdmin, labourController.addMasterLabour);
router.get("/master", isAdmin, labourController.getAllHeadLabours);
router.get("/master/:id", isAdmin, labourController.getHeadLabourById);
router.put("/master/:id", isAdmin, labourController.updateMasterLabour);
router.delete("/master/:id", isAdmin, labourController.deleteMasterLabour);

// ─── Sub-Labour Type CRUD ────────────────────────────────────────────────────
// POST   /api/labours/sublabour/other      → new type add
// GET    /api/labours/sublabour/other      → all types list
// PUT    /api/labours/sublabour/other/:id  → type name edit
// DELETE /api/labours/sublabour/other/:id  → type delete
router.post("/sublabour/other", isAdmin, labourController.addOtherType);
router.get("/sublabour/other", isAdmin, labourController.getAllSubTypes);
router.put("/sublabour/other/:id", isAdmin, labourController.updateSubType);
router.delete("/sublabour/other/:id", isAdmin, labourController.deleteSubType);

module.exports = router;