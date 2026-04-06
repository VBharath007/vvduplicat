const { body, param } = require("express-validator");
const { validationResult } = require("express-validator");

// ─── Middleware to check validation results ──────────────────────────────────
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

// ─── Material Master ─────────────────────────────────────────────────────────
exports.validateCreateMaterial = [
    body("name").notEmpty().withMessage("Material name is required"),
    body("unit").notEmpty().withMessage("Unit is required"),
    handleValidation,
];

// ─── Material Received ───────────────────────────────────────────────────────
exports.validateRecordMaterialReceived = [
    body("projectNo").notEmpty().withMessage("projectNo is required"),
    body("materialId").notEmpty().withMessage("materialId is required"),
    body("materialName").notEmpty().withMessage("materialName is required"),
    body("quantity").isFloat({ min: 0.01 }).withMessage("Quantity must be a positive number"),
    body("rate").isFloat({ min: 0 }).withMessage("Rate must be a non-negative number"),
    body("paidAmount").optional().isFloat({ min: 0 }).withMessage("paidAmount must be non-negative"),
    body("method").optional().isIn(["cash", "bank", "CASH", "BANK"]).withMessage("method must be cash or bank"),
    body("bankId").optional().isString().withMessage("bankId must be a string"),
    body("dealerName").optional().isString(),
    body("dealerContact").optional().isString(),
    body("remark").optional().isString(),
    handleValidation,
];

exports.validateUpdateMaterialReceived = [
    param("receiptId").notEmpty().withMessage("receiptId param is required"),
    body("quantity").optional().isFloat({ min: 0.01 }).withMessage("Quantity must be positive"),
    body("rate").optional().isFloat({ min: 0 }).withMessage("Rate must be non-negative"),
    body("paidAmount").optional().isFloat({ min: 0 }).withMessage("paidAmount must be non-negative"),
    body("method").optional().isIn(["cash", "bank", "CASH", "BANK"]).withMessage("method must be cash or bank"),
    body("bankId").optional().isString(),
    handleValidation,
];

// ─── Receipt Payment ─────────────────────────────────────────────────────────
exports.validateUpdateReceiptPayment = [
    param("receiptId").notEmpty().withMessage("receiptId param is required"),
    body("paidAmount").isFloat({ min: 0 }).withMessage("paidAmount must be a non-negative number"),
    body("method").optional().isIn(["cash", "bank", "CASH", "BANK"]).withMessage("method must be cash or bank"),
    body("bankId").optional().isString().withMessage("bankId must be a string"),
    handleValidation,
];

// ─── Dealer Purchase (existing) ──────────────────────────────────────────────
exports.validateDealerPurchase = [
    body("dealerName").notEmpty().withMessage("Dealer name is required"),
    body("dealerPhone").optional().isString().withMessage("Dealer phone must be a string"),
    body("quantity").isFloat({ min: 0.01 }).withMessage("Quantity must be a positive number"),
    body("amountPerUnit").isFloat({ min: 0 }).withMessage("Amount per unit must be a non-negative number"),
    body("date").notEmpty().withMessage("Date is required"),
    body("remark").optional().isString(),
    body("creditDays").optional().isInt({ min: 1 }).withMessage("Credit days must be a positive integer"),
    body("intervalPercent").optional().isFloat({ min: 1, max: 100 }).withMessage("Interval percent must be 1-100"),
    handleValidation,
];

// ─── Dealer Payment (existing) ───────────────────────────────────────────────
exports.validateDealerPayment = [
    body("amountPaid").isFloat({ min: 0.01 }).withMessage("amountPaid must be a positive number"),
    body("remark").optional().isString(),
    handleValidation,
];

// ─── Material Used ───────────────────────────────────────────────────────────
exports.validateRecordMaterialUsed = [
    body("projectNo").notEmpty().withMessage("projectNo is required"),
    body("materialId").notEmpty().withMessage("materialId is required"),
    body("quantityUsed").isFloat({ min: 0.01 }).withMessage("quantityUsed must be a positive number"),
    body("remark").optional().isString(),
    handleValidation,
];

// ─── Material Advance ────────────────────────────────────────────────────────
exports.validateCreateMaterialAdvance = [
    body("projectNo").notEmpty().withMessage("projectNo is required"),
    body("amountAdvance").isFloat({ min: 0.01 }).withMessage("amountAdvance must be positive"),
    body("paymentMethod").isIn(["CASH", "BANK"]).withMessage("paymentMethod must be CASH or BANK"),
    body("bankId").optional().isString(),
    body("remark").optional().isString(),
    handleValidation,
];