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
        const { projectNo } = req.query;
        const result = await advanceService.getAdvances(projectNo);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
