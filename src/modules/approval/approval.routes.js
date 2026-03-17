const express = require("express");
const router = express.Router();
const approvalController = require("./approval.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

// --- Project Type Options (Put SPECIFIC routes BEFORE general ones) --- //
router.put("/project-type", isAdmin, approvalController.addProjectType);
router.get("/project-type", approvalController.getProjectTypes);
router.put("/project-type/:id/confirm", isAdmin, approvalController.confirmProjectType);
router.delete("/project-type/:id", isAdmin, approvalController.deleteProjectType);

// --- Approval Management --- //
router.post("/", isAdmin, approvalController.createApproval);
router.get("/", isAdmin, approvalController.getApprovals);
router.get("/:id", isAdmin, approvalController.getApprovalById);
router.put("/:id", isAdmin, approvalController.updateApproval);
router.delete("/:id", isAdmin, approvalController.deleteApproval);

router.put("/:id/totalfees", isAdmin, approvalController.updateTotalFees);

// --- Advance Payment APIs --- //
router.post("/:id/advance", isAdmin, approvalController.addAdvance);
router.get("/:id/advance", isAdmin, approvalController.getAdvances);
router.put("/advance/:advanceId", isAdmin, approvalController.updateAdvance);
router.delete("/advance/:advanceId", isAdmin, approvalController.deleteAdvance);

// --- Expense APIs --- //
router.post("/:id/expense", isAdmin, approvalController.addExpense);
router.get("/:id/expense", isAdmin, approvalController.getExpenses);
router.put("/expense/:expenseId", isAdmin, approvalController.updateExpense);
router.delete("/expense/:expenseId", isAdmin, approvalController.deleteExpense);

// --- Status Update --- //
router.put("/:id/status", isAdmin, approvalController.updateStatus);

module.exports = router;
