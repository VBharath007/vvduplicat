const express = require("express");
const router = express.Router();
const dealerController = require("./dealer.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

// 1. Get all dealers
router.get("/", isAdmin, dealerController.getAllDealers);

// 2. SPECIFIC routes first (most specific path → least specific)
router.get("/:phoneNumber/payments", isAdmin, dealerController.getDealerPaymentHistory);
router.get("/:phoneNumber/payment-log", isAdmin, dealerController.getDealerPaymentLog);
router.get("/:phoneNumber/project/:projectNo/payment-log", isAdmin, dealerController.getDealerProjectPaymentLog);
router.put("/:phoneNumber/payment", isAdmin, dealerController.updateDealerPayment);
router.put("/:phoneNumber/project/:projectNo/payment", isAdmin, dealerController.payDealerProjectPayment);

// 3. GENERAL route LAST — catches /:phoneNumber only
router.get("/:phoneNumber", isAdmin, dealerController.getDealerHistory);

module.exports = router;