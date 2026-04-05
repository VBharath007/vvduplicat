const express = require("express");
const materialController = require("../controllers/material.controller");

const router = express.Router();

// Material Master
router.post("/", materialController.createMaterial);
router.get("/", materialController.getMaterials);

// Material Received (with BANK payment support)
router.post("/received", materialController.recordMaterialReceived);
router.get("/received", materialController.getMaterialReceived);
router.get("/received/materialId/:materialId", materialController.getMaterialReceivedByMaterialId);
router.put("/received/:receiptId/payment", materialController.updateReceiptPayment);
router.put("/received/:receiptId", materialController.updateMaterialReceived);
router.delete("/received/:receiptId", materialController.deleteMaterialReceived);

// Material Used
router.post("/used", materialController.recordMaterialUsed);
router.get("/used/:projectNo", materialController.getMaterialUsed);
router.put("/used/:usageId", materialController.updateMaterialUsed);
router.delete("/used/:usageId", materialController.deleteMaterialUsed);

// Material Stock
router.get("/stock/:projectNo", materialController.getMaterialStock);

// Material Required
router.post("/required", materialController.addMaterialRequired);
router.get("/required/:projectNo", materialController.getMaterialRequired);
router.get("/required/all", materialController.getAllMaterialRequired);

module.exports = router;