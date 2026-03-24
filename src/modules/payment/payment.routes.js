const express = require("express");
const router = express.Router();
const paymentController = require("./payment.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

// ─── Labour Payment CRUD ────────────────────────────────────────────────────
// POST   /api/payments                          → create payment
// GET    /api/payments/:labourId/:projectNo     → payment history (Screen 5)
// GET    /api/payments/:labourId                → all payments for a labour
// GET    /api/payments/detail/:paymentId        → single payment
// PUT    /api/payments/:paymentId               → edit payment
// DELETE /api/payments/:paymentId               → delete payment

// IMPORTANT: /detail/:paymentId must come before /:labourId to avoid conflict
router.post("/:projectNo/:labourId", isAdmin, paymentController.createPayment);
router.get("/detail/:paymentId", isAdmin, paymentController.getPaymentById);
router.get("/:labourId/:projectNo", isAdmin, paymentController.getPayments);
router.get("/:labourId", isAdmin, paymentController.getPayments);
router.put("/:paymentId", isAdmin, paymentController.updatePayment);
router.delete("/:paymentId", isAdmin, paymentController.deletePayment);

module.exports = router;