const express = require("express");
const router = express.Router();
const materialController = require("./material.controller");
const materialValidation = require("./material.validation");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

/** Material CRUD */
router.post("/", isAdmin, materialValidation.validateCreateMaterial, materialController.createMaterial);
router.get("/", isAdmin, materialController.getAllMaterials);
router.get("/:id", isAdmin, materialController.getMaterialById);
router.put("/:id", isAdmin, materialController.updateMaterial);
router.delete("/:id", isAdmin, materialController.deleteMaterial);

/** Dealer Operations */
router.post("/:id/purchase", isAdmin, materialValidation.validateDealerPurchase, materialController.dealerPurchase);

/** Dealer Payment — uses dealerId in URL */
router.put("/:materialId/dealer/:dealerId/payment", isAdmin, materialValidation.validateDealerPayment, materialController.dealerPayment);

module.exports = router;
