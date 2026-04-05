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
/**
 * POST /api/materials/received
 * Record material received with CASH or BANK payment
 * Body: {
 *   projectNo, materialId, materialName, quantity, rate, paidAmount, dealerName,
 *   date, paymentMethod ("CASH" | "BANK"), bankId?, bankName?
 * }
 */
router.post("/received", isAdmin, materialController.recordMaterialReceived);

/**
 * GET /api/materials/received
 * Get all material received or filter by projectNo
 */
router.get("/received", isAdmin, materialController.getMaterialReceived);

/**
 * GET /api/materials/received/:materialId
 * Get received records for a specific material
 */
router.get("/received/:materialId", isAdmin, materialController.getMaterialReceivedByMaterialId);

/**
 * PUT /api/materials/received/:receiptId
 * Update material received record
 */
router.put("/received/:receiptId", isAdmin, materialController.updateMaterialReceived);

/**
 * PUT /api/materials/received/:receiptId/payment
 * Update payment for receipt (CASH or BANK)
 * Body: { paidAmount, paymentMethod?, bankId?, bankName? }
 * Handles:
 * - Updating amount for CASH payment
 * - Switching from CASH to BANK (deletes expense, creates bank advance)
 * - Switching from BANK to CASH (reverts bank balance, creates expense)
 * - Changing BANK (reverts old bank, adds to new bank)
 */
router.put("/received/:receiptId/payment", isAdmin, materialController.updateReceiptPayment);

// --- Material Used --- //
/**
 * POST /api/materials/used
 * Record material used
 */
router.post("/used", isAdmin, materialController.recordMaterialUsed);

/**
 * GET /api/materials/used
 * Get all material used or filter by projectNo
 */
router.get("/used", isAdmin, materialController.getAllMaterialUsed);

/**
 * GET /api/materials/used/:projectNo
 * Get used records for a specific project
 */
router.get("/used/:projectNo", isAdmin, materialController.getAllMaterialUsed);

/**
 * PUT /api/materials/used/:usageId
 * Update material used record
 */
router.put("/used/:usageId", isAdmin, materialController.updateMaterialUsed);

/**
 * DELETE /api/materials/used/:usageId
 * Delete material used record and restore stock
 */
router.delete("/used/:usageId", isAdmin, materialController.deleteMaterialUsed);

// --- Material Stock --- //
/**
 * GET /api/materials/stock/:projectNo
 * Get material stock for a project
 */
router.get("/stock/:projectNo", isAdmin, materialController.getMaterialStock);

// --- Material Required --- //
/**
 * POST /api/materials/required
 * Add material required
 */
router.post("/required", isAdmin, materialController.addMaterialRequired);

/**
 * GET /api/materials/required
 * Get all material required
 */
router.get("/required", isAdmin, materialController.getAllMaterialRequired);

/**
 * GET /api/materials/required/:projectNo
 * Get material required for a project
 */
router.get("/required/:projectNo", isAdmin, materialController.getMaterialRequired);

module.exports = router;