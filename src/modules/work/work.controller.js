const workService = require("./work.service");
const labourService = require("../labour/labour.service");

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
        const { workId, projectNo } = req.params;
        const result = await workService.getWorkById(workId, projectNo);
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

exports.getWorkByDate = async (req, res, next) => {
    try {
        const projectNo = req.params.projectNo || req.query.projectNo;
        const date = req.params.date || req.query.date;

        if (!projectNo || !date) {
            return res.status(400).json({ success: false, message: "projectNo and date are required" });
        }
        const result = await workService.getWorkByDate(projectNo, date);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// Hierarchical Labour Assignment
// POST /api/works/project/:projectNo/:workId/master
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Accepts EITHER:
 *   { "headLabourId": "<doc ID>" }
 * OR:
 *   { "name": "ALAGAR", "contact": "1234567890" }
 *
 * If name is given:
 *   - Looks up existing master by name.
 *   - If not found, auto-registers a new master, then links.
 *
 * Optional: "subLabourDetails": { "MASON": 4, "MC": 3 }
 */
exports.assignLabourToWork = async (req, res) => {
    try {
        const { projectNo, workId } = req.params;
        let { headLabourId, name, contact, subLabourDetails } = req.body;

        // Resolve headLabourId from name if not provided directly
        if (!headLabourId && name) {
            let master;
            try {
                master = await labourService.getLabourMasterByName(name);
            } catch (_) {
                // Master not found → auto-register
                master = await labourService.addLabourMaster({ name, contact: contact || "N/A" });
            }
            headLabourId = master.id;
        }

        if (!headLabourId) {
            return res.status(400).json({
                success: false,
                message: "Provide either 'headLabourId' or 'name' in request body"
            });
        }

        const result = await workService.assignLabourToWork(
            projectNo, workId, headLabourId, subLabourDetails
        );
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// Update Sub-Labour Counts
// POST /api/works/project/:projectNo/:workId/sublabour
// ═══════════════════════════════════════════════════════════════════════════
exports.updateSubLabourForWork = async (req, res) => {
    try {
        const { projectNo, workId } = req.params;
        const { subLabourDetails } = req.body;

        if (!subLabourDetails || typeof subLabourDetails !== 'object') {
            return res.status(400).json({ success: false, message: "subLabourDetails (object) is required" });
        }

        const result = await workService.updateSubLabourForWork(
            projectNo, workId, subLabourDetails
        );
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};



// ═══════════════════════════════════════════════════════════════════════════
// Project-Based Labour Retrieval
// GET /api/works/project/:projectNo/labour
// ═══════════════════════════════════════════════════════════════════════════
exports.getLabourByProject = async (req, res) => {
    try {
        const { projectNo } = req.params;
        const works = await workService.getWorks(projectNo);

        const projectLabourHistory = works.map(w => ({
            workId: w.workId,
            date: w.date,
            workName: w.workName,
            headLabour: w.labourDetails?.headLabourName,
            headLabourPhone: w.labourDetails?.headLabourPhoneNumber,
            distribution: w.labourDetails?.subLabourDetails,
            totalLabourCount: w.labourDetails?.totalLabourCount ?? 0,
        }));

        res.json({ success: true, projectNo, history: projectLabourHistory });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// ═══════════════════════════════════════════════════════════════════════════
// Edit one sub-labour type count
// PUT /api/works/project/:projectNo/:workId/sublabour/:type
// Body: { "count": 5 }
// ═══════════════════════════════════════════════════════════════════════════
exports.editSubLabourCount = async (req, res) => {
    try {
        const { projectNo, workId, type } = req.params;
        const { count } = req.body;

        if (count === undefined || count === null) {
            return res.status(400).json({ success: false, message: "'count' is required in body" });
        }

        const result = await workService.editSubLabourCount(projectNo, workId, type, count);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// Delete one sub-labour type from a work
// DELETE /api/works/project/:projectNo/:workId/sublabour/:type
// ═══════════════════════════════════════════════════════════════════════════
exports.deleteSubLabourType = async (req, res) => {
    try {
        const { projectNo, workId, type } = req.params;
        const result = await workService.deleteSubLabourType(projectNo, workId, type);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/works/project/:projectNo/week?from=16-03-2026&to=21-03-2026
// ═══════════════════════════════════════════════════════════════════════════
exports.getWorksByWeek = async (req, res) => {
    try {
        const { projectNo } = req.params;
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: "Query params 'from' and 'to' are required (DD-MM-YYYY)"
            });
        }

        const result = await workService.getWorksByWeek(projectNo, from, to);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/labours/master/:labourId/works  (handled via work routes)
// ═══════════════════════════════════════════════════════════════════════════
exports.getWorksByLabour = async (req, res) => {
    try {
        const { labourId } = req.params;
        const result = await workService.getWorksByLabour(labourId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};