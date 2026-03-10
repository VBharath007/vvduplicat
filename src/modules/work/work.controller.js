const workService = require("./work.service");

exports.createWork = async (req, res, next) => {
    try {
        const result = await workService.createWork(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getWorks = async (req, res, next) => {
    try {
        const { projectNo } = req.query;
        const result = await workService.getWorks(projectNo);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getWorkById = async (req, res, next) => {
    try {
        const result = await workService.getWorkById(req.params.workId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.updateWork = async (req, res, next) => {
    try {
        const result = await workService.updateWork(req.params.workId, req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteWork = async (req, res, next) => {
    try {
        const result = await workService.deleteWork(req.params.workId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};


