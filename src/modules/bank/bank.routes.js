const express = require("express");
const router = express.Router();

const bankController = require("./bank.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

// ─────────────────────────────────────────────
// 📊 ALL BANKS + SUMMARY
// GET /api/banks
// ─────────────────────────────────────────────
router.get("/", isAdmin, bankController.getAllBanks);
router.post("/", isAdmin, bankController.createBank);
// ─────────────────────────────────────────────
// 🏦 SINGLE BANK
// GET /api/banks/:bankId
// ─────────────────────────────────────────────
router.get("/:bankId", isAdmin, bankController.getBankById);

// ─────────────────────────────────────────────
// 📜 TRANSACTIONS
// GET /api/banks/:bankId/transactions
// ─────────────────────────────────────────────
router.get("/:bankId/transactions", isAdmin, bankController.getBankTransactions);


router.get("/transactions/global", isAdmin, bankController.getGlobalTransactions);

module.exports = router;