const labourService = require("./labour.service");

// ─── Head Labour Master CRUD ────────────────────────────────────────────────

exports.addMasterLabour = async (req, res) => {
    try {
        if (!req.body.name) {
            return res.status(400).json({ error: "name is required" });
        }
        const result = await labourService.addLabourMaster(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateMasterLabour = async (req, res) => {
    try {
        const result = await labourService.updateLabourMaster(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteMasterLabour = async (req, res) => {
    try {
        const result = await labourService.deleteLabourMaster(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllHeadLabours = async (req, res) => {
    try {
        const result = await labourService.getLabourMasters();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getHeadLabourById = async (req, res) => {
    try {
        const result = await labourService.getLabourMasterById(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

// ─── Sub-Labour Type CRUD ───────────────────────────────────────────────────

exports.addOtherType = async (req, res) => {
    try {
        const typeName = req.body.labourType || req.body.typeName;

        if (!typeName) {
            return res.status(400).json({ error: "labourType or typeName is required" });
        }

        const result = await labourService.addOtherSubLabourType(typeName);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getAllSubTypes = async (req, res) => {
    try {
        const result = await labourService.getSubLabourTypes();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── Sub-Labour Type Edit & Delete ──────────────────────────────────────────

exports.updateSubType = async (req, res) => {
    try {
        const result = await labourService.updateSubLabourType(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteSubType = async (req, res) => {
    try {
        const result = await labourService.deleteSubLabourType(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};