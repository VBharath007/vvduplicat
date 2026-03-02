/*
const { db } = require('../config/firebase');
const pdfService = require('../services/pdfService');

// 1. Create Entry
exports.createApprovalEntry = async (req, res) => {
    try {
        const data = req.body;
        const total = parseFloat(data.financials?.totalFees || 0);
        const initial = parseFloat(data.financials?.initialPaid || 0);
        const subsequent = data.financials?.subsequentPayments?.reduce((s, p) => s + parseFloat(p.amount), 0) || 0;
        
        data.financials.totalPaidSoFar = initial + subsequent;
        data.financials.balanceToPay = total - data.financials.totalPaidSoFar;

        const docRef = await db.collection('approvals').add(data);
        res.status(201).json({ id: docRef.id, status: "Success" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 2. Get All Approvals
exports.getAllApprovals = async (req, res) => {
    try {
        const snapshot = await db.collection('approvals').get();
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(list);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 3. Get One Approval
exports.getOneApproval = async (req, res) => {
    try {
        const doc = await db.collection('approvals').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: "Not Found" });
        res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 4. Update Status & History
exports.updateApprovalStatus = async (req, res) => {
    try {
        const { newStatus, remarks } = req.body;
        const admin = require('firebase-admin');
        const docRef = db.collection('approvals').doc(req.params.id);

        await docRef.update({
            "statusTracking.currentStatus": newStatus,
            "statusTracking.lastUpdated": new Date().toISOString(),
            "statusTracking.history": admin.firestore.FieldValue.arrayUnion({
                status: newStatus,
                date: new Date().toISOString(),
                remarks: remarks || "Status Updated"
            })
        });
        res.status(200).json({ status: "Updated successfully" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 5. Delete Approval
exports.deleteApproval = async (req, res) => {
    try {
        await db.collection('approvals').doc(req.params.id).delete();
        res.status(200).json({ status: "Deleted successfully" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 6. Download PDF


exports.downloadCaseFile = async (req, res) => {
    try {
        const doc = await db.collection('approvals').doc(req.params.id).get();
        if (!doc.exists) {
            // Error handling-la return kandaipa venum, illana kela irukura code-um run aagum
            return res.status(404).send("File not found");
        }
        
        const data = doc.data();
        
        // 1. Headers kandaipa munnadiye set pannanum
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Case_${data.refNo}.pdf`);
        
        // 2. PDF Service call pannu
        // Inga 'await' venum-na service promise-ah return pannanum
        await pdfService.generateApprovalCaseFilePDF(data, res);

        // 🛑 MUKKIYAM: Inga thirumba res.send() illa res.end() poda koodadhu!
        // PDF Service-la irukura doc.end() response-ah finish pannidum.
        
    } catch (e) {
        console.error(e);
        // Headers already set aayiducha-nu check panni response anupanum
        if (!res.headersSent) {
            res.status(500).send(e.message);
        }
    }
};

*/




const { db } = require('../config/firebase');
const admin = require('firebase-admin');
const pdfService = require('../services/pdfService');

// 1. match: approvalController.createApproval
exports.createApproval = async (req, res) => {
    try {
        const data = req.body;
        const breakup = data.financials?.breakup || {};
        const totalFees = Object.values(breakup).reduce((a, b) => a + (parseFloat(b) || 0), 0);
        const initial = parseFloat(data.financials?.initialPaid || 0);
        
        const finalData = {
            ...data,
            financials: { ...data.financials, totalFees, balanceToPay: totalFees - initial },
            createdAt: admin.firestore.Timestamp.now()
        };
        const docRef = await db.collection('approvals').add(finalData);
        res.status(201).json({ id: docRef.id, status: "Success" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 2. match: approvalController.getAllApprovals
exports.getAllApprovals = async (req, res) => {
    try {
        const snapshot = await db.collection('approvals').get();
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(list);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 3. match: approvalController.getOneApproval
exports.getOneApproval = async (req, res) => {
    try {
        const doc = await db.collection('approvals').doc(req.params.id).get();
        res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 4. match: approvalController.updateStatus
exports.updateStatus = async (req, res) => {
    try {
        const clientInput = req.body;
        const docRef = db.collection('approvals').doc(req.params.id);
        const newEntry = {
            status: clientInput.status || "Updated",
            date: new Date().toISOString(),
            remarks: clientInput.remarks || "No remarks"
        };
        await docRef.update({
            "statusTracking.currentStatus": newEntry.status,
            "statusTracking.history": admin.firestore.FieldValue.arrayUnion(newEntry)
        });
        res.status(200).json({ status: "Updated successfully" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 5. match: approvalController.deleteApproval
exports.deleteApproval = async (req, res) => {
    try {
        await db.collection('approvals').doc(req.params.id).delete();
        res.status(200).json({ status: "Deleted" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 6. match: approvalController.downloadCaseFile
exports.downloadCaseFile = async (req, res) => {
    try {
        const doc = await db.collection('approvals').doc(req.params.id).get();
        const data = doc.data();
        res.setHeader('Content-Type', 'application/pdf');
        await pdfService.generateApprovalCaseFilePDF(data, res);
    } catch (e) { res.status(500).send(e.message); }
};