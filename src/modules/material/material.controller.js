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

exports.updateReceiptPayment = async (req, res, next) => {
    try {
        const result = await materialService.updateReceiptPayment(req.params.receiptId, req.body);
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

// --- Material Stock --- //
exports.getMaterialStock = async (req, res, next) => {
    try {
        const { projectNo } = req.query;
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

exports.updateMaterialRequired = async (req, res, next) => {
    try {
        const result = await materialService.updateMaterialRequired(req.params.id, req.body);
        res.status(200).json({ message: "Material Required Updated", data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getMaterialRequired = async (req, res, next) => {
    try {
        const result = await materialService.getMaterialRequired(req.params.projectNo);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};