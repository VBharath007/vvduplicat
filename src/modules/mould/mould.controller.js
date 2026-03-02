const mouldService = require("./mould.service");
const { validationResult } = require("express-validator");

const checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error("Validation failed");
        error.statusCode = 400;
        error.data = errors.array();
        console.log("VALIDATION ERRORS:", errors.array());
        throw error;
    }
};

/**
 * PURCHASE CONTROLLERS
 */

exports.createPurchase = async (req, res, next) => {
    try {
        checkValidation(req);
        const purchase = await mouldService.createPurchase(req.body);
        res.status(201).json({ success: true, data: purchase });
    } catch (error) {
        next(error);
    }
};

exports.getAllPurchases = async (req, res, next) => {
    try {
        const purchases = await mouldService.getAllPurchases();
        res.status(200).json({ success: true, data: purchases });
    } catch (error) {
        next(error);
    }
};

exports.getPurchaseById = async (req, res, next) => {
    try {
        const purchase = await mouldService.getPurchaseById(req.params.id);
        res.status(200).json({ success: true, data: purchase });
    } catch (error) {
        next(error);
    }
};

exports.updatePurchase = async (req, res, next) => {
    try {
        const purchase = await mouldService.updatePurchase(req.params.id, req.body);
        res.status(200).json({ success: true, data: purchase });
    } catch (error) {
        next(error);
    }
};

exports.deletePurchase = async (req, res, next) => {
    try {
        await mouldService.deletePurchase(req.params.id);
        res.status(200).json({ success: true, message: "Purchase item deleted" });
    } catch (error) {
        next(error);
    }
};

/**
 * RENTAL CONTROLLERS
 */

exports.createRental = async (req, res, next) => {
    try {
        checkValidation(req);
        const rental = await mouldService.createRental(req.body);
        res.status(201).json({ success: true, data: rental });
    } catch (error) {
        next(error);
    }
};

exports.getAllRentals = async (req, res, next) => {
    try {
        const rentals = await mouldService.getAllRentals();
        res.status(200).json({ success: true, data: rentals });
    } catch (error) {
        next(error);
    }
};

exports.getRentalById = async (req, res, next) => {
    try {
        const rental = await mouldService.getRentalById(req.params.id);
        res.status(200).json({ success: true, data: rental });
    } catch (error) {
        next(error);
    }
};

// PUT /rental/:id — supports addPayment or generic update
exports.updateRental = async (req, res, next) => {
    try {
        const result = await mouldService.updateRental(req.params.id, req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

exports.deleteRental = async (req, res, next) => {
    try {
        await mouldService.deleteRental(req.params.id);
        res.status(200).json({ success: true, message: "Rental deleted and stock restored" });
    } catch (error) {
        next(error);
    }
};

/**
 * PAYMENT & CLOSING
 */

exports.addPayment = async (req, res, next) => {
    try {
        checkValidation(req);
        const rental = await mouldService.addPayment(req.params.id, req.body);
        res.status(200).json({ success: true, data: rental });
    } catch (error) {
        next(error);
    }
};

exports.closeRental = async (req, res, next) => {
    try {
        await mouldService.closeRental(req.params.id);
        res.status(200).json({ success: true, message: "Rental closed successfully" });
    } catch (error) {
        next(error);
    }
};

/**
 * CLIENT + MATERIAL HISTORY
 * GET /rental/history?clientName=ABC&materialId=PUR001
 */
exports.getClientMaterialHistory = async (req, res, next) => {
    try {
        const { clientName, materialId } = req.query;
        if (!clientName || !materialId) {
            return res.status(400).json({ success: false, message: "clientName and materialId are required" });
        }
        const history = await mouldService.getClientMaterialHistory(clientName, materialId);
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
};

exports.calculateRental = async (req, res, next) => {
    try {
        checkValidation(req);
        const result = await mouldService.calculateRental(req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

exports.paymentUpdate = async (req, res, next) => {
    try {
        checkValidation(req);
        const result = await mouldService.paymentUpdate(req.params.id, req.body);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
