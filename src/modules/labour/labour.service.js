const { db } = require("../../config/firebase");
const { LABOUR_MASTERS, SUB_LABOUR_TYPES } = require("../../models/firestore.collections");
const dayjs = require("dayjs");

const banksCollection = db.collection("banks");
const labourMasterCollection = db.collection(LABOUR_MASTERS);
const subLabourTypeCollection = db.collection(SUB_LABOUR_TYPES);
const labourPaymentsCollection = db.collection("labourPayments");
const siteExpensesCollection = db.collection("siteExpenses");   // 🔥 NEW

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatDate = (date) => {
    if (!date) return null;
    if (typeof date === "string" && /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/.test(date)) return date;
    const d = dayjs(date);
    return d.isValid() ? d.format("DD-MM-YYYY HH:mm") : date;
};
const now = () => dayjs().format("DD-MM-YYYY HH:mm");
const today = () => dayjs().format("DD-MM-YYYY");

// ─── Default Sub-Labour Types ───────────────────────────────────────────────
const DEFAULT_SUB_LABOUR_TYPES = [
    "MASON", "MC", "FC", "STEEL WORK", "SHUTTERING WORK", "PAINTER", "TILES", "LOADMAN"
];

exports.initDefaultSubLabourTypes = async () => {
    try {
        const timestamp = now();
        const batch = db.batch();
        let addedCount = 0;
        for (const type of DEFAULT_SUB_LABOUR_TYPES) {
            const docId = type.replace(/\s+/g, "_");
            const docRef = subLabourTypeCollection.doc(docId);
            const doc = await docRef.get();
            if (!doc.exists) {
                batch.set(docRef, { typeName: type, isDefault: true, createdAt: timestamp, updatedAt: timestamp });
                addedCount++;
            }
        }
        if (addedCount > 0) await batch.commit();
    } catch (error) {
        console.error("❌ Error initializing default sub-labours:", error.message);
    }
};

// ─── Head Labour Master CRUD ────────────────────────────────────────────────
exports.addLabourMaster = async (data) => {
    if (!data.name) throw new Error("name is required");
    const normalizedName = data.name.trim().toUpperCase();
    const existing = await labourMasterCollection.where("name", "==", normalizedName).limit(1).get();
    if (!existing.empty) throw new Error(`Head labour '${normalizedName}' already exists`);

    const newLabour = { name: normalizedName, contact: data.contact || "N/A", createdAt: now() };
    const docRef = await labourMasterCollection.add(newLabour);
    return { id: docRef.id, ...newLabour };
};

exports.updateLabourMaster = async (id, data) => {
    const docRef = labourMasterCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Head labour master not found");
    const updateData = { ...data, updatedAt: now() };
    if (updateData.name) updateData.name = updateData.name.trim().toUpperCase();
    await docRef.update(updateData);
    const updated = await docRef.get();
    return { id, ...updated.data() };
};

exports.deleteLabourMaster = async (id) => {
    const docRef = labourMasterCollection.doc(id);
    if (!(await docRef.get()).exists) throw new Error("Head labour master not found");
    await docRef.delete();
    return { message: "Head labour master deleted successfully" };
};

exports.getLabourMasters = async () => {
    const snap = await labourMasterCollection.orderBy("name", "asc").get();
    return snap.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, createdAt: formatDate(data.createdAt), updatedAt: formatDate(data.updatedAt) };
    });
};

exports.getLabourMasterById = async (id) => {
    const doc = await labourMasterCollection.doc(id).get();
    if (!doc.exists) throw new Error("Head labour master not found");
    const data = doc.data();
    return { id: doc.id, ...data, createdAt: formatDate(data.createdAt), updatedAt: formatDate(data.updatedAt) };
};

exports.getLabourMasterByName = async (name) => {
    const normalized = name.trim().toUpperCase();
    const snap = await labourMasterCollection.where("name", "==", normalized).limit(1).get();
    if (snap.empty) throw new Error(`Head labour '${normalized}' not found`);
    const doc = snap.docs[0];
    const data = doc.data();
    return { id: doc.id, ...data, createdAt: formatDate(data.createdAt), updatedAt: formatDate(data.updatedAt) };
};

// ─── Sub-Labour Type CRUD ───────────────────────────────────────────────────
exports.addOtherSubLabourType = async (typeName) => {
    if (!typeName) throw new Error("typeName is required");
    const normalized = typeName.trim().toUpperCase();
    const docId = normalized.replace(/\s+/g, "_");
    const docRef = subLabourTypeCollection.doc(docId);
    await docRef.set({ typeName: normalized, isDefault: false, updatedAt: now() }, { merge: true });
    const doc = await docRef.get();
    if (!doc.data().createdAt) await docRef.update({ createdAt: now() });
    const finalDoc = await docRef.get();
    const finalData = finalDoc.data();
    return { id: docId, ...finalData, createdAt: formatDate(finalData.createdAt), updatedAt: formatDate(finalData.updatedAt) };
};

exports.getSubLabourTypes = async () => {
    const snap = await subLabourTypeCollection.orderBy("typeName", "asc").get();
    return snap.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, createdAt: formatDate(data.createdAt), updatedAt: formatDate(data.updatedAt) };
    });
};

exports.updateSubLabourType = async (id, data) => {
    const docRef = subLabourTypeCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error(`Sub-labour type '${id}' not found`);
    const existing = doc.data();
    if (existing.isDefault) throw new Error(`Cannot edit default sub-labour type '${existing.typeName}'`);
    const updateData = { updatedAt: now() };
    if (data.typeName || data.labourType) updateData.typeName = (data.typeName || data.labourType).trim().toUpperCase();
    await docRef.update(updateData);
    const updated = await docRef.get();
    return { id, ...updated.data() };
};

exports.deleteSubLabourType = async (id) => {
    const docRef = subLabourTypeCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error(`Sub-labour type '${id}' not found`);
    const existing = doc.data();
    if (existing.isDefault) throw new Error(`Cannot delete default sub-labour type '${existing.typeName}'`);
    await docRef.delete();
    return { message: `Sub-labour type '${existing.typeName}' deleted successfully` };
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── LABOUR PAYMENTS  (with siteExpenses auto-sync) ───────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mirror a labour payment into siteExpenses (same doc ID — easy sync).
 *
 * IMPORTANT:  If the payment was made via BANK, we've ALREADY debited the
 * bank balance inside recordLabourPayment().  So the siteExpense mirror
 * must NOT deduct again.  We store paymentMethod so the expense module
 * knows this record is a "mirror" and not a standalone expense.
 */
async function _syncLabourPaymentToSiteExpense(paymentId, payment) {
    const rawDate = payment.date ? payment.date.split("T")[0] : today();

    await siteExpensesCollection.doc(paymentId).set({
        projectNo:         payment.projectNo,
        type:              "labourPayment",               // 🔒 guarded in expense.service
        labourId:          payment.labourId,
        labourName:        payment.labourName,
        amount:            Number(payment.amountPaid) || 0,
        paymentMethod:     (payment.method || "cash").toUpperCase(),   // "CASH" | "BANK"
        bankId:            payment.bankId || null,
        bankName:          payment.bankName || null,
        bankTransactionId: payment.bankTransactionId || null,
        remark:            payment.remark || `Labour Payment – ${payment.labourName}`,
        particular:        `Labour Payment – ${payment.labourName}`,
        date:              rawDate,
        fromDate:          payment.fromDate || null,
        toDate:            payment.toDate   || null,
        paymentId,                                        // back-reference
        createdAt:         payment.createdAt || new Date().toISOString(),
        updatedAt:         payment.updatedAt || null,
    }, { merge: true });
}

exports.recordLabourPayment = async (labourId, projectNo, data) => {
    const { amount, method = "cash", bankId, fromDate, toDate, remark = "" } = data;
    if (!amount || Number(amount) <= 0) throw new Error("Valid amount is required");

    const paymentAmount = Number(amount);
    const paymentMethod = method.toLowerCase();

    const labourDoc = await labourMasterCollection.doc(labourId).get();
    if (!labourDoc.exists) throw new Error("Labour not found");
    const labourData = labourDoc.data();

    let bankData = null;
    let bankTransactionId = null;

    // ── BANK mode: deduct balance + create bank transaction ────────────────
    if (paymentMethod === "bank") {
        if (!bankId) throw new Error("bankId is required for bank payments");
        const bankDoc = await banksCollection.doc(bankId).get();
        if (!bankDoc.exists) throw new Error("Bank not found");

        bankData = bankDoc.data();
        const currentBalance = Number(bankData.currentBalance || 0);
        if (currentBalance < paymentAmount) throw new Error("Insufficient bank balance");

        const newBalance = currentBalance - paymentAmount;
        await banksCollection.doc(bankId).update({
            currentBalance: newBalance,
            closingBalance: newBalance,
            updatedAt: new Date().toISOString(),
        });

        const txnRef = await banksCollection.doc(bankId).collection("transactions").add({
            type: "DEBIT",
            amount: paymentAmount,
            remark: `Labour Payment - ${labourData.name} (${projectNo})`,
            transactionType: "LABOUR_PAYMENT",
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            createdAt: new Date().toISOString(),
            relatedLabour: labourId,
            relatedProject: projectNo,
        });
        bankTransactionId = txnRef.id;
    }

    // ── Save master record in labourPayments ───────────────────────────────
    const payment = {
        labourId,
        labourName: labourData.name,
        projectNo,
        amountPaid: paymentAmount,
        method: paymentMethod,
        bankId: bankId || null,
        bankName: bankData?.accountName || bankData?.bankName || null,
        bankTransactionId,
        fromDate: fromDate || null,
        toDate: toDate || null,
        remark,
        date: new Date().toISOString(),
        createdAt: now(),
    };

    const ref = await labourPaymentsCollection.add(payment);

    // ── 🔥 Mirror into siteExpenses (CASH or BANK both) ────────────────────
    try {
        await _syncLabourPaymentToSiteExpense(ref.id, payment);
    } catch (syncErr) {
        console.error("⚠️ siteExpense sync failed for payment", ref.id, syncErr.message);
        // we don't throw — payment is already recorded; admin can re-sync later
    }

    return { id: ref.id, ...payment };
};

exports.getLabourPaymentsByProject = async (labourId, projectNo) => {
    const snap = await labourPaymentsCollection
        .where("labourId", "==", labourId)
        .where("projectNo", "==", projectNo)
        .get();
    const payments = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
    return { payments, totalPaid, count: payments.length };
};

exports.getLabourPayments = async (labourId) => {
    const snap = await labourPaymentsCollection.where("labourId", "==", labourId).get();
    const payments = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
    return { payments, totalPaid, count: payments.length };
};

exports.getPaymentById = async (paymentId) => {
    const doc = await labourPaymentsCollection.doc(paymentId).get();
    if (!doc.exists) throw new Error("Payment not found");
    return { id: doc.id, ...doc.data() };
};

exports.updateLabourPayment = async (paymentId, data) => {
    const docRef = labourPaymentsCollection.doc(paymentId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Payment not found");

    const updateData = { updatedAt: now() };
    if (data.amount   !== undefined) updateData.amountPaid = Number(data.amount);
    if (data.remark   !== undefined) updateData.remark   = data.remark;
    if (data.method   !== undefined) updateData.method   = data.method.toLowerCase();
    if (data.bankId   !== undefined) updateData.bankId   = data.bankId;
    if (data.fromDate !== undefined) updateData.fromDate = data.fromDate;
    if (data.toDate   !== undefined) updateData.toDate   = data.toDate;

    await docRef.update(updateData);
    const updated = await docRef.get();
    const finalPayment = { id: paymentId, ...updated.data() };

    // ── 🔥 Mirror the update into siteExpenses ─────────────────────────────
    try {
        await _syncLabourPaymentToSiteExpense(paymentId, finalPayment);
    } catch (syncErr) {
        console.error("⚠️ siteExpense update-sync failed for payment", paymentId, syncErr.message);
    }

    return finalPayment;
};

exports.deleteLabourPayment = async (paymentId) => {
    const docRef = labourPaymentsCollection.doc(paymentId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Payment not found");

    await docRef.delete();

    // ── 🔥 Remove the siteExpense mirror ───────────────────────────────────
    try {
        const expRef = siteExpensesCollection.doc(paymentId);
        if ((await expRef.get()).exists) await expRef.delete();
    } catch (syncErr) {
        console.error("⚠️ siteExpense delete-sync failed for payment", paymentId, syncErr.message);
    }

    return { message: "Payment deleted successfully", id: paymentId };
};