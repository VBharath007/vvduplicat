const express = require("express");
const router = express.Router();
const approvalController = require("./approval.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

// --- Approval Management --- //
router.post("/", isAdmin, approvalController.createApproval);
router.get("/", isAdmin, approvalController.getApprovals);
router.get("/:id", isAdmin, approvalController.getApprovalById);
router.put("/:id", isAdmin, approvalController.updateApproval);

// --- Advance Payment APIs --- //
router.post("/:id/advance", isAdmin, approvalController.addAdvance);
router.get("/:id/advance", isAdmin, approvalController.getAdvances);

// --- Expense APIs --- //
router.post("/:id/expense", isAdmin, approvalController.addExpense);
router.get("/:id/expense", isAdmin, approvalController.getExpenses);

// --- Status Update --- //
router.put("/:id/status", isAdmin, approvalController.updateStatus);

module.exports = router;
