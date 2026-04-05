const materialService = require("./material.service");

// --- Material Master --- //
exports.createMaterial = async (req, res, next) => {
    try {
        const result = await materialService.createMaterial(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getMaterials = async (req, res, next) => {
    try {
        const result = await materialService.getMaterials();
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Material Received --- //
/**
 * POST /api/materials/received
 * Body: {
 *   projectNo, materialId, materialName, quantity, rate, paidAmount, dealerName,
 *   date, paymentMethod ("CASH" | "BANK"), bankId?, bankName?
 * }
 * BANK PAYMENT: paidAmount is DEDUCTED from bank balance
 */
exports.recordMaterialReceived = async (req, res, next) => {
    try {
        const result = await materialService.recordMaterialReceived(req.body);
        res.status(201).json({ 
            success: true, 
            data: result,
            message: result.paymentMethod === 'BANK' 
                ? `Material received. Bank balance reduced by ₹${result.paidAmount}` 
                : `Material received and expense recorded`
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getMaterialReceived = async (req, res, next) => {
    try {
        const { projectNo } = req.query;
        const result = await materialService.getMaterialReceived(projectNo);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMaterialReceivedByMaterialId = async (req, res, next) => {
    try {
        const result = await materialService.getMaterialReceivedByMaterialId(req.params.materialId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

/**
 * PUT /api/materials/received/:receiptId/payment
 * Update payment for receipt (CASH or BANK)
 * Body: { paidAmount, paymentMethod?, bankId?, bankName? }
 * BANK PAYMENT: paidAmount is DEDUCTED from bank balance
 */
exports.updateReceiptPayment = async (req, res, next) => {
    try {
        const result = await materialService.updateReceiptPayment(req.params.receiptId, req.body);
        res.status(200).json({ 
            success: true, 
            data: result,
            message: result.paymentMethod === 'BANK'
                ? `Payment updated. Bank balance adjusted by ₹${req.body.paidAmount}`
                : `Payment updated`
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateMaterialReceived = async (req, res, next) => {
    try {
        const result = await materialService.updateMaterialReceived(req.params.receiptId, req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteMaterialReceived = async (req, res, next) => {
    try {
        const result = await materialService.deleteMaterialReceived(req.params.receiptId);
        res.status(200).json({ success: true, message: "Material receipt deleted and transactions reverted", data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// --- Material Used --- //
exports.recordMaterialUsed = async (req, res, next) => {
    try {
        const result = await materialService.recordMaterialUsed(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getAllMaterialUsed = async (req, res, next) => {
    try {
        const { projectNo } = req.params;
        const snap = require("../../config/firebase").db.collection("materialUsed");
        const query = projectNo ? snap.where("projectNo", "==", projectNo) : snap;
        const result = await query.get();
        const data = result.docs.map(doc => ({ usageId: doc.id, ...doc.data() }));
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMaterialUsed = async (req, res, next) => {
    try {
        const { projectNo } = req.params;
        const result = await materialService.getMaterialUsedByProject(projectNo);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateMaterialUsed = async (req, res, next) => {
    try {
        const result = await materialService.updateMaterialUsed(req.params.usageId, req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteMaterialUsed = async (req, res, next) => {
    try {
        const result = await materialService.deleteMaterialUsed(req.params.usageId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// --- Material Stock --- //
exports.getMaterialStock = async (req, res, next) => {
    try {
        const { projectNo } = req.params;
        const result = await materialService.getMaterialStock(projectNo);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// --- Material Required --- //
exports.addMaterialRequired = async (req, res, next) => {
    try {
        const result = await materialService.addMaterialRequired(req.body);
        res.status(201).json({ message: "Material Required Added", id: result.requiredId, data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getMaterialRequired = async (req, res, next) => {
    try {
        const result = await materialService.getMaterialRequired(req.params.projectNo);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllMaterialRequired = async (req, res, next) => {
    try {
        const result = await materialService.getAllMaterialRequired();
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};