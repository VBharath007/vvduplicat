const express = require("express");
const router = express.Router();
const labourController = require("./labour.controller");
const workController = require("../work/work.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

router.put("/:labourId/payment", isAdmin, labourController.payLabour);

// ─── Head Labour Master CRUD ────────────────────────────────────────────────
router.post("/master", isAdmin, labourController.addMasterLabour);
router.get("/master", isAdmin, labourController.getAllHeadLabours);
router.get("/master/:id", isAdmin, labourController.getHeadLabourById);
router.put("/master/:id", isAdmin, labourController.updateMasterLabour);
router.delete("/master/:id", isAdmin, labourController.deleteMasterLabour);

// ⚠️ NEW: Filtered work details for specific labour in specific project
// GET /api/labours/master/:labourId/projects/:projectNo/works/:workId
// router.get("/master/:labourId/projects/:projectNo/works/:workId", isAdmin, labourController.getLabourWorkDetails);

// GET /api/labours/master/:labourId/works - All works by this labour
router.get("/master/:labourId/works", isAdmin, workController.getWorksByLabour);

// ─── Sub-Labour Type CRUD ────────────────────────────────────────────────────
router.post("/sublabour/other", isAdmin, labourController.addOtherType);
router.get("/sublabour/other", isAdmin, labourController.getAllSubTypes);
router.put("/sublabour/other/:id", isAdmin, labourController.updateSubType);
router.delete("/sublabour/other/:id", isAdmin, labourController.deleteSubType);

// Line 19 - add before the general /works route
router.get("/master/:labourId/projects/:projectNo/works", isAdmin, labourController.getLabourProjectWorks);
router.get("/master/:labourId/works", isAdmin, workController.getWorksByLabour);

module.exports = router;