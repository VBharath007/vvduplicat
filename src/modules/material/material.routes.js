const express = require("express");
const router = express.Router();
const materialController = require("./material.controller");

// --- Material Master --- //
router.post("/", materialController.createMaterial);
router.get("/", materialController.getMaterials);

// --- Material Received --- //
router.post("/received", materialController.recordMaterialReceived);
router.get("/received", materialController.getMaterialReceived);
router.put("/received/:receiptId/payment", materialController.updateReceiptPayment);

// --- Material Used --- //
router.post("/used", materialController.recordMaterialUsed);

// --- Material Stock --- //
router.get("/stock", materialController.getMaterialStock);

// --- Material Required --- //
router.post("/required", materialController.addMaterialRequired);
router.put("/required/:id", materialController.updateMaterialRequired);
router.get("/required/:projectNo", materialController.getMaterialRequired);

module.exports = router;
