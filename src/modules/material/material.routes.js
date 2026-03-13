const express = require("express");
const router = express.Router();
const materialController = require("./material.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

// --- Material Master --- //
// router.post("/", isAdmin, materialController.createMaterial);
// router.get("/", isAdmin, materialController.getMaterials);

// --- Material Received --- //
router.post("/received", isAdmin, materialController.recordMaterialReceived);
router.get("/received", isAdmin, materialController.getMaterialReceived);
router.get("/received/:materialId", isAdmin, materialController.getMaterialReceivedByMaterialId);
router.put("/received/:receiptId", isAdmin, materialController.updateMaterialReceived);
router.put("/received/:receiptId/payment", isAdmin, materialController.updateReceiptPayment);

// --- Material Used --- //
router.post("/used", isAdmin, materialController.recordMaterialUsed);
router.get("/used", isAdmin, materialController.getAllMaterialUsed);
router.get("/used/:projectNo", isAdmin, materialController.getAllMaterialUsed);

// --- Material Stock --- //
router.get("/stock/:projectNo", isAdmin, materialController.getMaterialStock);

// --- Material Required --- //
router.post("/required", isAdmin, materialController.addMaterialRequired);

router.get("/required", isAdmin, materialController.getAllMaterialRequired);
router.get("/required/:projectNo", isAdmin, materialController.getMaterialRequired);

module.exports = router;

