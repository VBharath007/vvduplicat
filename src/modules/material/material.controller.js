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
exports.recordMaterialReceived = async (req, res, next) => {
    try {
        const result = await materialService.recordMaterialReceived(req.body);
        res.status(201).json({ success: true, data: result });
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

exports.updateReceiptPayment = async (req, res, next) => {
    try {
        const result = await materialService.updateReceiptPayment(
            req.params.receiptId,
            req.body
        );

        res.status(200).json({
            success: true,
            data: result,
            message:
                req.body.method === "bank"
                    ? "Material payment done & bank updated"
                    : "Material payment updated"
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
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
        res.status(200).json({ success: true, data: result });
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

exports.addMaterialRequired = async (req, res, next) => {
    try {
        const result = await materialService.addMaterialRequired(req.body);
        res.status(201).json({ message: "Material Required Added", id: result.id, data: result });
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

// ═════════════════════════════════════════════════════════════════════════════
// ──── MATERIAL ADVANCE PAYMENT CONTROLLERS ──────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/materials/advances
 * Create a new material advance payment
 */
exports.createMaterialAdvance = async (req, res, next) => {
    try {
        const result = await materialService.createMaterialAdvance(req.body);
        res.status(201).json({ 
            success: true, 
            data: result,
            message: `Material advance created successfully${result.paymentMethod === 'BANK' ? ' and bank balance updated with transaction record' : ''}`
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/materials/advances
 * GET /api/materials/advances?projectNo=P001
 * GET /api/materials/advances/project/:projectNo
 * Get material advances for a project or all advances
 */
exports.getMaterialAdvances = async (req, res, next) => {
    try {
        const projectNo = req.params.projectNo || req.query.projectNo;
        const result = await materialService.getMaterialAdvances(projectNo);
        res.status(200).json({ 
            success: true, 
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PUT /api/materials/advances/:id
 * Update a material advance record
 * If amount or paymentMethod changes, bank balance and transactions are updated
 */
exports.updateMaterialAdvance = async (req, res, next) => {
    try {
        const result = await materialService.updateMaterialAdvance(req.params.id, req.body);
        res.status(200).json({ 
            success: true, 
            data: result,
            message: "Material advance updated successfully and bank transactions adjusted if applicable"
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * DELETE /api/materials/advances/:id
 * Delete a material advance record
 * If paymentMethod was BANK, the bank balance will be reverted with transaction record
 */
exports.deleteMaterialAdvance = async (req, res, next) => {
    try {
        const result = await materialService.deleteMaterialAdvance(req.params.id);
        res.status(200).json({ 
            success: true, 
            ...result,
            message: "Material advance deleted successfully and bank balance adjusted with reverse transaction"
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/materials/advances/bank/:bankId/transactions
 * Get transaction history for a specific bank account (material advances)
 */
exports.getBankTransactionHistoryForMaterialAdvance = async (req, res, next) => {
    try {
        const { bankId } = req.params;
        const result = await materialService.getBankTransactionHistoryForMaterialAdvance(bankId);
        res.status(200).json({ 
            success: true, 
            data: result,
            message: "Bank transaction history retrieved successfully"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = exports;