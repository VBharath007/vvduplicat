const express = require("express");
const router = express.Router();
const expenseController = require("./expense.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

router.post("/", isAdmin, expenseController.createExpense);
router.get("/", isAdmin, expenseController.getExpenses);

module.exports = router;
