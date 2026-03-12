const express = require("express");
const router = express.Router();
const dealerController = require("./dealer.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

// 1. Get all dealers
router.get("/", isAdmin, dealerController.getAllDealers);

// 2. SPECIFIC routes first (More slashes/fixed paths)
router.get("/:phoneNumber/payments", isAdmin, dealerController.getDealerPaymentHistory);
router.put("/:phoneNumber/payment", isAdmin, dealerController.updateDealerPayment);

// 3. GENERAL routes last
router.get("/:phoneNumber", isAdmin, dealerController.getDealerHistory);

module.exports = router;