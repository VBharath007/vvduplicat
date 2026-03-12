const express = require("express");
const router = express.Router();
const expenseController = require("./expense.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

// Define parameter route first to avoid 404 collisions
router.get("/project/:projectNo", isAdmin, expenseController.getExpenses);
router.post("/", isAdmin, expenseController.createExpense);

module.exports = router;