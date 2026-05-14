const additionalWorkService = require("./additionalWork.service");

exports.createAdditionalWork = async (req, res, next) => {
    try {
        const result = await additionalWorkService.addAdditionalWork(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

exports.getAllAdditionalWorks = async (req, res, next) => {
    try {
        const { projectNo } = req.query;
        const result = await additionalWorkService.getAdditionalWorks(projectNo);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

exports.getAdditionalWorkById = async (req, res, next) => {
    try {
        const result = await additionalWorkService.getAdditionalWorkById(req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

exports.updateAdditionalWork = async (req, res, next) => {
    try {
        const result = await additionalWorkService.updateAdditionalWork(req.params.id, req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

exports.deleteAdditionalWork = async (req, res, next) => {
    try {
        const result = await additionalWorkService.deleteAdditionalWork(req.params.id);
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
};
