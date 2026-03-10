const express = require("express");
const router = express.Router();
const approvalController = require("./approval.controller");

// --- Approval Management --- //
router.post("/", approvalController.createApproval);
router.get("/", approvalController.getApprovals);
router.get("/:id", approvalController.getApprovalById);
router.put("/:id", approvalController.updateApproval);

// --- Advance Payment APIs --- //
router.post("/:id/advance", approvalController.addAdvance);
router.get("/:id/advance", approvalController.getAdvances);

// --- Expense APIs --- //
router.post("/:id/expense", approvalController.addExpense);
router.get("/:id/expense", approvalController.getExpenses);

// --- Status Update --- //
router.put("/:id/status", approvalController.updateStatus);

module.exports = router;
