// src/modules/project/bank.routes.js

const express = require("express");
const router = express.Router();
const bankController = require("./bank.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

// Bank account management
router.get("/", isAdmin, bankController.getAllBanks);
router.post("/", isAdmin, bankController.createBank);
router.put("/:bankId", isAdmin, bankController.updateBank);

// Add advance with payment mode
router.post("/:projectNo/advance-payment", isAdmin, bankController.addAdvanceWithPaymentMode);

module.exports = router;