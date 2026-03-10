const { body } = require("express-validator");

exports.validateCreateMaterial = [
    body("name").notEmpty().withMessage("Material name is required"),
    body("unit").notEmpty().withMessage("Unit is required"),
];

exports.validateDealerPurchase = [
    body("dealerName").notEmpty().withMessage("Dealer name is required"),
    body("dealerPhone").optional().isString().withMessage("Dealer phone must be a string"),
    body("quantity").isFloat({ min: 0.01 }).withMessage("Quantity must be a positive number"),
    body("amountPerUnit").isFloat({ min: 0 }).withMessage("Amount per unit must be a non-negative number"),
    body("date").notEmpty().withMessage("Date is required"),
    body("remark").optional().isString(),
    body("creditDays").optional().isInt({ min: 1 }).withMessage("Credit days must be a positive integer"),
    body("intervalPercent").optional().isFloat({ min: 1, max: 100 }).withMessage("Interval percent must be 1-100"),
];

exports.validateDealerPayment = [
    body("amountPaid").isFloat({ min: 0.01 }).withMessage("amountPaid must be a positive number"),
    body("remark").optional().isString(),
];
