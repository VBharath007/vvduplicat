const projectService = require('../services/projectService');
const pdfService = require('../services/pdfService');
const { bucket } = require('../config/firebase');

exports.addProject = async (req, res) => {
    try {
        let imageUrls = [];
        const result = await projectService.createProject({ ...req.body, siteImages: imageUrls });
        res.status(201).json(result);
    } catch (e) {
        if (e.code === 'INVALID_NAME') return res.status(400).json({ success: false, error: e.message });
        if (e.code === 'DUPLICATE_NAME') return res.status(409).json({ success: false, error: e.message });
        res.status(500).json({ error: e.message });
    }
};

exports.getProjects = async (req, res) => {
    try {
        const data = await projectService.getAllProjects();
        res.status(200).json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getProject = async (req, res) => {
    try {
        const data = await projectService.getProjectById(req.params.id);
        if (data) {
            res.status(200).json(data);
        } else {
            res.status(404).json({ message: "Project not found!" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.patchProject = async (req, res) => {
    try {
        const result = await projectService.updateProject(req.params.id, req.body);
        res.status(200).json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.removeProject = async (req, res) => {
    try {
        await projectService.deleteProject(req.params.id);
        res.status(200).json({ message: "Deleted Successfully" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 🌟 THE PDF DOWNLOAD LOGIC
exports.downloadProjectInvoice = async (req, res) => {
    try {
        const projectId = req.params.id;
        const projectData = await projectService.getProjectById(projectId);

        if (!projectData) {
            return res.status(404).json({ message: "Project not found!" });
        }

        // Setting PDF Headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice_${projectData.projectName.replace(/\s+/g, '_')}.pdf`);

        // ✨ Function name mapping (Indha peyar pdfService-la irukuratha check pannunga)
        await pdfService.generateProjectInvoicePDF(projectData, res);

    } catch (error) {
        console.error("PDF Download Error:", error);
        res.status(500).json({ error: error.message });
    }
};