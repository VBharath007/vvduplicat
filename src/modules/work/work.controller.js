const workService = require("./work.service");

exports.createWork = async (req, res, next) => {
    try {
        const result = await workService.createWork(req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getWorks = async (req, res, next) => {
    try {
        const projectNo = req.params.projectNo || req.query.projectNo;
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

/**
 * GET /works/by-date?projectNo=PRO001&date=2026-03-12
 * Returns the single work document for that project+date, or null.
 */
exports.getWorkByDate = async (req, res, next) => {
    try {
        const projectNo = req.params.projectNo || req.query.projectNo;
        const date = req.params.date || req.query.date;

        if (!projectNo || !date) {
            return res.status(400).json({ success: false, message: "projectNo and date are required" });
        }
        const result = await workService.getWorkByDate(projectNo, date);
        res.status(200).json({ success: true, data: result }); // data is null if not found
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};