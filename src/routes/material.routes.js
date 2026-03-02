const express = require("express");
const router = express.Router();
const materialController = require("../controllers/material.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");



/* Material CRUD */
router.post("/create", verifyToken, authorize(["admin"]), materialController.createMaterial);
router.get("/get-all", verifyToken, authorize(["admin"]), materialController.getAll);
router.get("/get/:id", verifyToken, authorize(["admin"]), materialController.getById);
router.put("/update/:id", verifyToken, authorize(["admin"]), materialController.updateMaterial);
router.put("/payment/:id", verifyToken, authorize(["admin"]), materialController.updatePayment);
router.delete("/delete/:id", verifyToken, authorize(["admin"]), materialController.deleteMaterial);

/* Dealer Ledger */
router.post("/dealer-transaction", verifyToken, authorize(["admin"]), materialController.addDealerTransaction);
router.get("/ledger/:id", verifyToken, authorize(["admin"]), materialController.getMaterialLedger);
router.get("/ledger/:id/:dealerName", verifyToken, authorize(["admin"]), materialController.getDealerLedger);
router.post(
    "/consume/:materialId",
    verifyToken,
    authorize(["admin"]),
    materialController.consumeMaterial
);

module.exports = router;
