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
    body("customerName").notEmpty().withMessage("Customer name is required"),
    body("phoneNumber").notEmpty().withMessage("Phone number is required"),
    body("customerLocation").optional().isString(),
    body("rentalBasis").isIn(["Day", "Week", "Month", "Outright"]).withMessage("Rental basis must be Day, Week, Month, or Outright"),
    body("quantity").isNumeric().withMessage("Quantity must be a number"),
    body("rate").isNumeric().withMessage("Rate must be a number"),
    body("approxReturnDate").notEmpty().withMessage("Approx Return Date is required"),
    body("actualReturnDate").optional().isString(),
    body("amountPaid").isNumeric().withMessage("Amount paid must be a number"),
    body("paymentStatus").isIn(["Paid", "Pending"]).withMessage("Payment Status must be Paid or Pending")
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

// 🟡 NEW MOULD GENERAL INVENTORY VALIDATION
exports.validateAddNewMould = [
    body("mouldName").notEmpty().withMessage("Mould name is required"),
    body("mouldId").notEmpty().withMessage("Mould ID is required"),
    body("dimensions.length").notEmpty().withMessage("Length is required"),
    body("dimensions.width").notEmpty().withMessage("Width is required"),
    body("dimensions.height").notEmpty().withMessage("Height is required"),
    body("location").optional().isString(),
    body("materialType").isIn(["Steel", "Aluminium", "Composite", "Wood"]).withMessage("Invalid Material Type"),
    body("stockUnits").isNumeric().withMessage("Stock Units must be a number"),
    body("unitPrice").isNumeric().withMessage("Unit Price must be a number")
];
