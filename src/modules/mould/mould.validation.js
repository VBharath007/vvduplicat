const { body } = require("express-validator");

exports.validatePurchase = [
    body("materialName").notEmpty().withMessage("Material name is required"),
    body("size").notEmpty().withMessage("Size is required"),
    body("totalQuantity").isNumeric().withMessage("Total quantity must be a number"),
    body("unitType").isIn(["NOS", "SET"]).withMessage("Unit type must be NOS or SET"),
    body("rent.rentAmount").optional().isNumeric().withMessage("Rent amount must be a number"),
    body("rent.rentType").optional().isIn(["DAY", "MONTH"]).withMessage("Rent type must be DAY or MONTH"),
];

exports.validateRental = [
    body("clientName").notEmpty().withMessage("Client name is required"),
    body("items").isArray({ min: 1 }).withMessage("Items must be a non-empty array"),
    body("items.*.materialId").notEmpty().withMessage("Item material ID is required"),
    body("items.*.quantity").isNumeric().withMessage("Item quantity must be a number"),
    body("startDate").isISO8601().withMessage("Start date must be a valid date"),
    body("endDate").isISO8601().withMessage("End date must be a valid date")
];

exports.validateCalculateRental = [
    body("clientName").notEmpty().withMessage("Client name is required"),
    body("items").isArray({ min: 1 }).withMessage("Items must be a non-empty array"),
    body("items.*.materialId").notEmpty().withMessage("Item material ID is required"),
    body("items.*.quantity").isFloat({ min: 0.01 }).withMessage("Item quantity must be a number greater than 0"),
    body("startDate").isISO8601().withMessage("Start date must be a valid date"),
    body("endDate").isISO8601().withMessage("End date must be a valid date")
        .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.body.startDate)) {
                throw new Error("End date must be after start date");
            }
            return true;
        })
];

exports.validatePaymentUpdate = [
    body("balance").isNumeric().withMessage("Balance amount must be a number"),
    body("note").optional().isString()
];

exports.validatePayment = [
    body("amount").isNumeric().withMessage("Amount must be a number"),
    body("date").optional().isISO8601().withMessage("Date must be a valid date"),
    body("note").optional().isString(),
];