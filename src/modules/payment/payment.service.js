const { db } = require("../../config/firebase");
const dayjs = require("dayjs");

const labourPaymentsCollection = db.collection("labourPayments");
const siteExpensesCollection = db.collection("siteExpenses");

const now = () => dayjs().format("DD-MM-YY HH:mm");
const today = () => dayjs().format("DD-MM-YYYY");

// ── Resolve labour name live from master registry ───────────────────────────
// Lazy-require to avoid circular dependency issues
async function _resolveLabourName(labourId) {
    if (!labourId) return "Unknown";
    try {
        const labourService = require("../labour/labour.service");
        const master = await labourService.getLabourMasterById(labourId);
        return (master && master.name) ? master.name : "Unknown";
    } catch (_) {
        return "Unknown";
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER — sync a labourPayment into siteExpenses so _getFinancials picks it up
// ═══════════════════════════════════════════════════════════════════════════
async function _syncToSiteExpense(paymentId, paymentData) {
    const expenseRef = siteExpensesCollection.doc(paymentId);
    await expenseRef.set({
        projectNo: paymentData.projectNo,
        type: "labourPayment",
        labourId: paymentData.labourId,
        labourName: paymentData.labourName,
        amount: Number(paymentData.amount) || 0,
        remark: paymentData.remark || `Labour Payment – ${paymentData.labourName}`,
        particular: `Labour Payment – ${paymentData.labourName}`,
        date: paymentData.paidDate || today(),
        fromDate: paymentData.fromDate || null,
        toDate: paymentData.toDate || null,
        paymentId,
        createdAt: paymentData.createdAt,
        updatedAt: paymentData.updatedAt || null,
    }, { merge: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE PAYMENT
// POST /api/payments
// Body: { labourId, projectNo, fromDate, toDate, amount, remark }
// ═══════════════════════════════════════════════════════════════════════════
exports.createPayment = async (data) => {
    if (!data.labourId) throw new Error("labourId is required");
    if (!data.projectNo) throw new Error("projectNo is required");
    if (!data.amount) throw new Error("amount is required");

    // Resolve labour name live from master registry
    const labourName = await _resolveLabourName(data.labourId);

    const payload = {
        labourId: data.labourId,
        labourName,
        projectNo: data.projectNo,
        fromDate: data.fromDate || null,
        toDate: data.toDate || null,
        amount: Number(data.amount) || 0,
        remark: (data.remark || "").trim(),
        paidDate: today(),
        createdAt: now(),
    };

    // 1. Save to labourPayments
    const docRef = await labourPaymentsCollection.add(payload);
    const paymentId = docRef.id;

    // 2. Mirror into siteExpenses so project financials auto-update
    await _syncToSiteExpense(paymentId, payload);

    return { paymentId, ...payload };
};

// ═══════════════════════════════════════════════════════════════════════════
// GET PAYMENTS — by labourId or projectNo or both
// GET /api/payments?labourId=xxx
// GET /api/payments?projectNo=PROJ001
// GET /api/payments?labourId=xxx&projectNo=PROJ001
// ═══════════════════════════════════════════════════════════════════════════
exports.getPayments = async ({ labourId, projectNo } = {}) => {
    let query = labourPaymentsCollection;

    if (labourId && projectNo) {
        query = query
            .where("labourId", "==", labourId)
            .where("projectNo", "==", projectNo);
    } else if (labourId) {
        query = query.where("labourId", "==", labourId);
    } else if (projectNo) {
        query = query.where("projectNo", "==", projectNo);
    }

    const snap = await query.get();
    const rawPayments = snap.docs.map(doc => ({ paymentId: doc.id, ...doc.data() }));

    // Resolve labourName live for every payment — fixes old "Unknown" docs too
    const payments = await Promise.all(
        rawPayments.map(async (p) => ({
            ...p,
            labourName: await _resolveLabourName(p.labourId),
        }))
    );

    // Sort latest first
    payments.sort((a, b) =>
        dayjs(b.createdAt, "DD-MM-YY HH:mm").valueOf() -
        dayjs(a.createdAt, "DD-MM-YY HH:mm").valueOf()
    );

    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return { payments, totalPaid };
};

// ═══════════════════════════════════════════════════════════════════════════
// GET SINGLE PAYMENT
// GET /api/payments/:paymentId
// ═══════════════════════════════════════════════════════════════════════════
exports.getPaymentById = async (paymentId) => {
    const doc = await labourPaymentsCollection.doc(paymentId).get();
    if (!doc.exists) throw new Error("Payment not found");
    const data = doc.data();
    // Always resolve live — handles old docs stored with "Unknown"
    const labourName = await _resolveLabourName(data.labourId);
    return { paymentId: doc.id, ...data, labourName };
};

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE PAYMENT
// PUT /api/payments/:paymentId
// Body: { amount?, remark?, fromDate?, toDate? }
// ═══════════════════════════════════════════════════════════════════════════
exports.updatePayment = async (paymentId, updateData) => {
    const docRef = labourPaymentsCollection.doc(paymentId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Payment not found");

    const allowed = {};
    if (updateData.amount !== undefined) allowed.amount = Number(updateData.amount) || 0;
    if (updateData.remark !== undefined) allowed.remark = updateData.remark.trim();
    if (updateData.fromDate !== undefined) allowed.fromDate = updateData.fromDate;
    if (updateData.toDate !== undefined) allowed.toDate = updateData.toDate;
    allowed.updatedAt = now();

    // 1. Update labourPayments
    await docRef.update(allowed);
    const updated = await docRef.get();
    const updatedData = { paymentId, ...updated.data() };

    // 2. Keep siteExpenses in sync
    await _syncToSiteExpense(paymentId, updatedData);

    return updatedData;
};

// ═══════════════════════════════════════════════════════════════════════════
// DELETE PAYMENT
// DELETE /api/payments/:paymentId
// ═══════════════════════════════════════════════════════════════════════════
exports.deletePayment = async (paymentId) => {
    const docRef = labourPaymentsCollection.doc(paymentId);
    if (!(await docRef.get()).exists) throw new Error("Payment not found");

    // 1. Delete from labourPayments
    await docRef.delete();

    // 2. Remove mirrored entry from siteExpenses
    const expRef = siteExpensesCollection.doc(paymentId);
    const expDoc = await expRef.get();
    if (expDoc.exists) await expRef.delete();

    return { message: "Payment deleted successfully" };
};