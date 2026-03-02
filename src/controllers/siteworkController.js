const siteworkService = require('../services/siteworkService');
const pdfService = require('../services/pdfService');

// ➕ 1. ADD DAILY REPORT
exports.addReport = async (req, res) => {
    try {
        const result = await siteworkService.addDailyReport(req.body);
        res.status(201).json({
            status: "Success",
            message: "Report Added & Material Stock Updated Successfully",
            data: result
        });
    } catch (e) {
        console.error("Sitework Controller Error:", e);
        res.status(500).json({ status: "Error", message: "Failed to process report", details: e.message });
    }
};

// 📖 2. GET HISTORY (by projectId)
exports.getHistory = async (req, res) => {
    try {
        const { projectId } = req.params;
        const history = await siteworkService.getProjectHistory(projectId);
        res.status(200).json({ status: "Success", count: history.length, data: history });
    } catch (e) {
        res.status(500).json({ status: "Error", details: e.message });
    }
};

// 📝 3. EDIT / UPDATE REPORT
exports.editReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { db } = require('../config/firebase');
        // Check if the report document exists first
        const docSnap = await db.collection('siteworks').doc(id).get();
        if (!docSnap.exists) {
            return res.status(404).json({
                status: "Error",
                message: `Report with ID "${id}" not found in siteworks collection. Make sure you are passing the report document ID, not the project ID.`
            });
        }
        const result = await siteworkService.updateReport(id, req.body);
        res.status(200).json({ status: "Success", message: "Report updated successfully", data: result });
    } catch (e) {
        res.status(500).json({ status: "Error", details: e.message });
    }
};

// 🗑️ 4. DELETE REPORT
exports.removeReport = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await siteworkService.deleteReport(id);
        res.status(200).json({ status: "Success", message: result.message });
    } catch (e) {
        res.status(500).json({ status: "Error", details: e.message });
    }
};

// 📄 5. DOWNLOAD ALL REPORTS (PDF)
exports.downloadAllReports = async (req, res) => {
    try {
        const { projectId } = req.query;  // Optional: /download/all?projectId=xxx
        const { db } = require('../config/firebase');

        let reports;
        if (projectId) {
            reports = await siteworkService.getProjectHistory(projectId);
        } else {
            // No orderBy — avoids needing a Firestore composite index
            const snap = await db.collection('siteworks').get();
            reports = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort in memory by timestamp (newest first)
            reports.sort((a, b) => {
                const tA = a.entryDetails?.timestamp?.toMillis?.() || 0;
                const tB = b.entryDetails?.timestamp?.toMillis?.() || 0;
                return tB - tA;
            });
        }

        if (!reports || reports.length === 0) {
            return res.status(200).json({ status: "Success", message: "No reports found.", data: [] });
        }

        const title = projectId
            ? `Daily Site Reports — Project ${projectId}`
            : `All Daily Site Reports`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=SiteReport_${Date.now()}.pdf`);

        await pdfService.generateBulkReportPDF(reports, res, title);

    } catch (e) {
        console.error("Download Error:", e);
        if (!res.headersSent) res.status(500).json({ status: "Error", details: e.message });
    }
};