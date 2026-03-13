const advanceService = require("./advance.service");

exports.createAdvance = async (req, res, next) => {
    try {
        const result = await advanceService.createAdvance(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getAdvances = async (req, res, next) => {
    try {
        const projectNo = req.params.projectNo || req.query.projectNo;
        const result = await advanceService.getAdvances(projectNo);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateAdvance = async (req, res, next) => {
    try {
        const result = await advanceService.updateAdvance(req.params.id, req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteAdvance = async (req, res, next) => {
    try {
        const result = await advanceService.deleteAdvance(req.params.id);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
