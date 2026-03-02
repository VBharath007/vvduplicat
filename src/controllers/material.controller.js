const materialService = require("../services/material.service");
const { convertToIST } = require("../utils/dateFormatter");

/* ==========================================
   CREATE MATERIAL
========================================== */
exports.createMaterial = async (req, res) => {
    try {
        const result = await materialService.createMaterial(req.body);

        res.status(201).json({
            success: true,
            message: "Material added successfully",
            data: result
        });

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};


/* ==========================================
   GET ALL MATERIALS
========================================== */
exports.getAll = async (req, res) => {
    try {
        const data = await materialService.getAllMaterials();

        res.json({ success: true, data });

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};


/* ==========================================
   GET MATERIAL BY ID
========================================== */
exports.getById = async (req, res) => {
    try {
        const data = await materialService.getMaterialById(req.params.id);

        res.json({ success: true, data });

    } catch (err) {
        res.status(404).json({ success: false, message: err.message });
    }
};


/* ==========================================
   UPDATE MATERIAL
========================================== */
exports.updateMaterial = async (req, res) => {
    try {
        const data = await materialService.updateMaterial(
            req.params.id,
            req.body
        );

        res.json({
            success: true,
            message: "Material updated successfully",
            data
        });

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};


/* ==========================================
   PAYMENT UPDATE
========================================== */
exports.updatePayment = async (req, res) => {
    try {
        const { paymentAmount } = req.body;

        const data = await materialService.updatePayment(
            req.params.id,
            paymentAmount
        );

        res.json({
            success: true,
            message: "Payment updated successfully",
            data
        });

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};


/* ==========================================
   ADD DEALER TRANSACTION (Running Ledger)
========================================== */
exports.addDealerTransaction = async (req, res) => {
    try {
        const { materialId, dealerName, quantity, date, remark } = req.body;

        const data = await materialService.addDealerTransaction(
            materialId,
            dealerName,
            quantity,
            date,
            remark
        );

        res.status(201).json({
            success: true,
            message: "Dealer transaction added successfully",
            data
        });

    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};


/* ==========================================
   GET FULL MATERIAL LEDGER
========================================== */
exports.getMaterialLedger = async (req, res) => {
    try {
        const data = await materialService.getMaterialLedger(
            req.params.id
        );

        res.json({
            success: true,
            data
        });

    } catch (err) {
        res.status(404).json({
            success: false,
            message: err.message
        });
    }
};


/* ==========================================
   GET SPECIFIC DEALER LEDGER
========================================== */
exports.getDealerLedger = async (req, res) => {
    try {
        const { id, dealerName } = req.params;

        const data = await materialService.getDealerLedger(
            id,
            dealerName
        );

        res.json({
            success: true,
            data
        });

    } catch (err) {
        res.status(404).json({
            success: false,
            message: err.message
        });
    }
};


/* ==========================================
   DELETE MATERIAL
========================================== */
exports.deleteMaterial = async (req, res) => {
    try {
        await materialService.deleteMaterial(req.params.id);

        res.json({
            success: true,
            message: "Material deleted successfully"
        });

    } catch (err) {
        res.status(404).json({ success: false, message: err.message });
    }
};

/* ==========================================
   CONSUME MATERIAL
========================================== */
exports.consumeMaterial = async (req, res) => {
    try {
        const { materialId } = req.params;

        const result = await materialService.consumeMaterial(
            materialId,
            req.body
        );

        return res.status(200).json(result);

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};
