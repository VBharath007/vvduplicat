const { db } = require("../../config/firebase");
const { LABOUR_MASTERS, SUB_LABOUR_TYPES } = require("../../models/firestore.collections");
const dayjs = require("dayjs");
const banksCollection = db.collection("banks");

const labourMasterCollection = db.collection(LABOUR_MASTERS);
const subLabourTypeCollection = db.collection(SUB_LABOUR_TYPES);

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatDate = (date) => {
    if (!date) return null;
    if (typeof date === 'string' && /^\d{2}-\d{2}-\d{2} \d{2}:\d{2}$/.test(date)) return date;
    const d = dayjs(date);
    return d.isValid() ? d.format("DD-MM-YY HH:mm") : date;
};

const now = () => dayjs().format("DD-MM-YY HH:mm");

// ─── Default Sub-Labour Types ───────────────────────────────────────────────
const DEFAULT_SUB_LABOUR_TYPES = [
    "MASON", "MC", "FC", "STEEL WORK", "SHUTTERING WORK",
    "PAINTER", "TILES", "LOADMAN"
];

exports.initDefaultSubLabourTypes = async () => {
    try {
        const timestamp = now();
        const batch = db.batch();
        let addedCount = 0;

        for (const type of DEFAULT_SUB_LABOUR_TYPES) {
            const docId = type.replace(/\s+/g, '_');
            const docRef = subLabourTypeCollection.doc(docId);
            const doc = await docRef.get();

            if (!doc.exists) {
                batch.set(docRef, {
                    typeName: type,
                    isDefault: true,
                    createdAt: timestamp,
                    updatedAt: timestamp
                });
                addedCount++;
            }
        }

        if (addedCount > 0) {
            await batch.commit();
            process.stdout.write(`ℹ Added ${addedCount} default sub-labour types.\n`);
        } else {
            process.stdout.write("ℹ Default sub-labour types already exist.\n");
        }
    } catch (error) {
        process.stdout.write("❌ Error initializing default sub-labours: " + error.message + "\n");
    }
};

// ─── Head Labour Master CRUD ────────────────────────────────────────────────

/**
 * Adds a new head labour/contractor to the Global Master Registry.
 * Strict Normalization: name → UPPERCASE, trimmed.
 * Duplicate Guard: rejects if the same normalized name already exists.
 */
exports.addLabourMaster = async (data) => {
    if (!data.name) throw new Error("name is required");
    const normalizedName = data.name.trim().toUpperCase();

    // Duplicate Guard – prevent two masters with the same name
    const existing = await labourMasterCollection
        .where("name", "==", normalizedName).limit(1).get();
    if (!existing.empty) {
        throw new Error(`Head labour '${normalizedName}' already exists`);
    }

    const newLabour = {
        name: normalizedName,
        contact: data.contact || "N/A",
        createdAt: now()
    };
    const docRef = await labourMasterCollection.add(newLabour);
    return { id: docRef.id, ...newLabour };
};

/**
 * Updates head labour master.
 * Integrity: name is re-normalized if provided.
 */
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
        return {
            id: doc.id,
            ...data,
            createdAt: formatDate(data.createdAt),
            updatedAt: formatDate(data.updatedAt)
        };
    });
};

/**
 * Fetches a single head labour master by its Firestore document ID.
 */
exports.getLabourMasterById = async (id) => {
    const doc = await labourMasterCollection.doc(id).get();
    if (!doc.exists) throw new Error("Head labour master not found");
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: formatDate(data.createdAt),
        updatedAt: formatDate(data.updatedAt)
    };
};

/**
 * Fetches a single head labour master by normalized name.
 */
exports.getLabourMasterByName = async (name) => {
    const normalized = name.trim().toUpperCase();
    const snap = await labourMasterCollection
        .where("name", "==", normalized).limit(1).get();
    if (snap.empty) throw new Error(`Head labour '${normalized}' not found in Master Registry`);
    const doc = snap.docs[0];
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: formatDate(data.createdAt),
        updatedAt: formatDate(data.updatedAt)
    };
};

// ─── Sub-Labour Type CRUD ───────────────────────────────────────────────────

/**
 * Adds or updates a sub-labour type (upsert by normalized name).
 * Used for both default and custom "OTHERS" types.
 */
exports.addOtherSubLabourType = async (typeName) => {
    if (!typeName) throw new Error("typeName is required");
    const normalized = typeName.trim().toUpperCase();
    const docId = normalized.replace(/\s+/g, '_');
    const docRef = subLabourTypeCollection.doc(docId);

    const data = {
        typeName: normalized,
        isDefault: false,
        updatedAt: now()
    };

    // Merge → create or update
    await docRef.set(data, { merge: true });

    // Ensure createdAt exists for new docs
    const doc = await docRef.get();
    if (!doc.data().createdAt) {
        await docRef.update({ createdAt: now() });
    }

    const finalDoc = await docRef.get();
    const finalData = finalDoc.data();
    return {
        id: docId,
        ...finalData,
        createdAt: formatDate(finalData.createdAt),
        updatedAt: formatDate(finalData.updatedAt)
    };
};

exports.getSubLabourTypes = async () => {
    const snap = await subLabourTypeCollection.orderBy("typeName", "asc").get();
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: formatDate(data.createdAt),
            updatedAt: formatDate(data.updatedAt)
        };
    });
};
// ─── Sub-Labour Type Edit & Delete ─────────────────────────────────────────

/**
 * Edit an existing sub-labour type name.
 * Cannot rename default types — only custom ones.
 */
exports.updateSubLabourType = async (id, data) => {
    const docRef = subLabourTypeCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error(`Sub-labour type '${id}' not found`);

    const existing = doc.data();
    if (existing.isDefault) {
        throw new Error(`Cannot edit default sub-labour type '${existing.typeName}'`);
    }

    const updateData = { updatedAt: now() };
    if (data.typeName || data.labourType) {
        updateData.typeName = (data.typeName || data.labourType).trim().toUpperCase();
    }

    await docRef.update(updateData);
    const updated = await docRef.get();
    const updatedData = updated.data();
    return {
        id,
        ...updatedData,
        createdAt: formatDate(updatedData.createdAt),
        updatedAt: formatDate(updatedData.updatedAt)
    };
};

/**
 * Delete a sub-labour type.
 * Cannot delete default types — only custom ones.
 */
exports.deleteSubLabourType = async (id) => {
    const docRef = subLabourTypeCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error(`Sub-labour type '${id}' not found`);

    const existing = doc.data();
    if (existing.isDefault) {
        throw new Error(`Cannot delete default sub-labour type '${existing.typeName}'`);
    }

    await docRef.delete();
    return { message: `Sub-labour type '${existing.typeName}' deleted successfully` };
};

exports.payLabour = async (labourId, amount, method, bankId) => {
    if (!labourId) throw new Error("labourId is required");
    if (!amount || Number(amount) <= 0)
        throw new Error("Valid amount required");

    const paymentAmount = Number(amount);
    const paymentMethod = (method || "cash").toLowerCase();

    let bankData = null;
    let currentBalance = 0;
    let newBalance = 0;
    let bankTransactionId = null;

    // ─────────────────────────────
    // 🏦 BANK LOGIC (DEBIT)
    // ─────────────────────────────
    if (paymentMethod === "bank") {
        if (!bankId) throw new Error("bankId is required");

        const bankDoc = await banksCollection.doc(bankId).get();
        if (!bankDoc.exists) throw new Error("Bank not found");

        bankData = bankDoc.data();
        currentBalance = Number(bankData.currentBalance || 0);

        if (currentBalance < paymentAmount) {
            throw new Error("Insufficient bank balance");
        }

        newBalance = currentBalance - paymentAmount;

        // update bank
        await banksCollection.doc(bankId).update({
            currentBalance: newBalance,
            closingBalance: newBalance,
            updatedAt: new Date().toISOString()
        });

        // transaction
        const txnRef = await banksCollection
            .doc(bankId)
            .collection("transactions")
            .add({
                type: "DEBIT",
                amount: paymentAmount,
                remark: `Labour Payment - ${labourId}`,
                transactionType: "LABOUR_PAYMENT",
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                createdAt: new Date().toISOString(),
                relatedLabour: labourId
            });

        bankTransactionId = txnRef.id;
    }

    // ─────────────────────────────
    // 💰 EXISTING LOGIC PLACE
    // ─────────────────────────────
    // 👉 DO NOT MODIFY YOUR EXISTING PAYMENT LOGIC
    // Just call it here if exists OR add your own logic

    // Example placeholder:
    // await yourExistingLabourPaymentLogic(labourId, paymentAmount);

    // ─────────────────────────────
    // 📄 SAVE PAYMENT RECORD
    // ─────────────────────────────
    await db.collection("labourPayments").add({
        labourId,
        amountPaid: paymentAmount,
        method: paymentMethod,
        bankId: bankId || null,
        bankName: bankData?.accountName || null,
        bankTransactionId: bankTransactionId || null,
        date: new Date().toISOString(),
        type: "Payment",
    });

    return {
        success: true,
        message: "Labour payment successful"
    };
};// ═════════════════════════════════════════════════════════════════════════════
// ─── LABOUR PAYMENTS (ADD THIS TO THE END OF labour.service.js) ────────────
// ═════════════════════════════════════════════════════════════════════════════

const paymentsCollection = db.collection("labourPayments");

const getFormattedDate = (date) =>
    date ? dayjs(date).format("DD-MM-YYYY") : dayjs().format("DD-MM-YYYY");

/**
 * Record a labour payment
 * @param {string} labourId
 * @param {string} projectNo
 * @param {object} paymentData - { amount, method, bankId?, fromDate, toDate, remark }
 */
exports.recordLabourPayment = async (labourId, projectNo, paymentData) => {
    if (!labourId || !projectNo) {
        throw new Error("labourId and projectNo are required");
    }
    if (!paymentData.amount || Number(paymentData.amount) <= 0) {
        throw new Error("Valid amount is required");
    }
    if (!paymentData.method) {
        throw new Error("Payment method (cash/bank) is required");
    }

    const amount = Number(paymentData.amount);
    const method = (paymentData.method || "cash").toLowerCase();
    const fromDate = getFormattedDate(paymentData.fromDate);
    const toDate = getFormattedDate(paymentData.toDate);
    const remark = paymentData.remark || "";

    let bankName = null;
    let bankTransactionId = null;

    // 🏦 BANK PAYMENT LOGIC
    if (method === "bank") {
        if (!paymentData.bankId) {
            throw new Error("bankId is required for bank payments");
        }

        const bankDoc = await banksCollection.doc(paymentData.bankId).get();
        if (!bankDoc.exists) {
            throw new Error(`Bank with ID ${paymentData.bankId} not found`);
        }

        const bankData = bankDoc.data();
        const currentBalance = Number(bankData.currentBalance || 0);

        if (currentBalance < amount) {
            throw new Error(`Insufficient bank balance. Available: ₹${currentBalance}`);
        }

        const newBalance = currentBalance - amount;

        // Update bank balance (DEBIT)
        await banksCollection.doc(paymentData.bankId).update({
            currentBalance: newBalance,
            closingBalance: newBalance,
            updatedAt: new Date().toISOString()
        });

        // Create transaction
        const transactionRef = await banksCollection
            .doc(paymentData.bankId)
            .collection("transactions")
            .add({
                type: "DEBIT",
                amount: amount,
                projectNo: projectNo,
                labourId: labourId,
                remark: `Labour Payment: ${remark || "N/A"}`,
                date: new Date().toISOString(),
                transactionType: "LABOUR_PAYMENT",
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                createdAt: new Date().toISOString(),
                relatedPaymentId: null // Will be set after payment created
            });

        bankName = bankData.accountName || bankData.bankName || "Bank";
        bankTransactionId = transactionRef.id;
    }

    // Save payment record
    const paymentRecord = {
        labourId,
        projectNo,
        amount,
        method,
        bankId: method === "bank" ? paymentData.bankId : null,
        bankName: method === "bank" ? bankName : null,
        bankTransactionId: method === "bank" ? bankTransactionId : null,
        fromDate,
        toDate,
        remark,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const paymentRef = await paymentsCollection.add(paymentRecord);

    // Update transaction with payment ID reference
    if (method === "bank" && bankTransactionId) {
        await banksCollection
            .doc(paymentData.bankId)
            .collection("transactions")
            .doc(bankTransactionId)
            .update({
                relatedPaymentId: paymentRef.id
            });
    }

    return {
        paymentId: paymentRef.id,
        ...paymentRecord
    };
};

/**
 * Get all payments for a labour in a specific project
 */
exports.getLabourPaymentsByProject = async (labourId, projectNo) => {
    if (!labourId || !projectNo) {
        throw new Error("labourId and projectNo are required");
    }

    const snapshot = await paymentsCollection
        .where("labourId", "==", labourId)
        .where("projectNo", "==", projectNo)
        .orderBy("date", "desc")
        .get();

    const payments = snapshot.docs.map(doc => ({
        paymentId: doc.id,
        ...doc.data()
    }));

    let totalPaid = 0;
    payments.forEach(p => {
        totalPaid += Number(p.amount) || 0;
    });

    return {
        labourId,
        projectNo,
        payments,
        totalPaid
    };
};

/**
 * Get all payments for a labour (across all projects)
 */
exports.getLabourPayments = async (labourId) => {
    if (!labourId) {
        throw new Error("labourId is required");
    }

    const snapshot = await paymentsCollection
        .where("labourId", "==", labourId)
        .orderBy("date", "desc")
        .get();

    const payments = snapshot.docs.map(doc => ({
        paymentId: doc.id,
        ...doc.data()
    }));

    let totalPaid = 0;
    payments.forEach(p => {
        totalPaid += Number(p.amount) || 0;
    });

    return {
        labourId,
        payments,
        totalPaid
    };
};

/**
 * Get payment details by ID
 */
exports.getPaymentById = async (paymentId) => {
    const doc = await paymentsCollection.doc(paymentId).get();
    if (!doc.exists) {
        throw new Error("Payment record not found");
    }

    return {
        paymentId: doc.id,
        ...doc.data()
    };
};

/**
 * Update a labour payment
 */
exports.updateLabourPayment = async (paymentId, updateData) => {
    const docRef = paymentsCollection.doc(paymentId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error("Payment record not found");
    }

    const existingData = doc.data();
    const oldAmount = Number(existingData.amount) || 0;
    const newAmount = updateData.amount !== undefined ? Number(updateData.amount) : oldAmount;

    if (newAmount <= 0) {
        throw new Error("Amount must be greater than 0");
    }

    const oldMethod = (existingData.method || "cash").toLowerCase();
    const newMethod = updateData.method ? updateData.method.toLowerCase() : oldMethod;
    const oldBankId = existingData.bankId;
    const newBankId = updateData.bankId;

    // 🏦 BANK ADJUSTMENT LOGIC
    const amountDiff = newAmount - oldAmount;

    // CASE 1: Both BANK, amount changed
    if (oldMethod === "bank" && newMethod === "bank") {
        const bankId = newBankId || oldBankId;
        if (!bankId) throw new Error("bankId required");

        if (amountDiff !== 0) {
            const bankDoc = await banksCollection.doc(bankId).get();
            if (!bankDoc.exists) throw new Error("Bank not found");

            const bankData = bankDoc.data();
            const currentBalance = Number(bankData.currentBalance || 0);
            const newBalance = currentBalance - amountDiff;

            if (newBalance < 0) {
                throw new Error("Insufficient bank balance for adjustment");
            }

            await banksCollection.doc(bankId).update({
                currentBalance: newBalance,
                closingBalance: newBalance,
                updatedAt: new Date().toISOString()
            });

            // Create adjustment transaction
            await banksCollection
                .doc(bankId)
                .collection("transactions")
                .add({
                    type: amountDiff > 0 ? "DEBIT" : "CREDIT",
                    amount: Math.abs(amountDiff),
                    projectNo: existingData.projectNo,
                    labourId: existingData.labourId,
                    remark: `Payment adjustment: ${existingData.remark || "N/A"}`,
                    date: new Date().toISOString(),
                    transactionType: "LABOUR_PAYMENT_ADJUSTMENT",
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    createdAt: new Date().toISOString(),
                    relatedPaymentId: paymentId,
                    originalTransactionId: existingData.bankTransactionId
                });
        }
    }
    // CASE 2: CASH → BANK
    else if (oldMethod === "cash" && newMethod === "bank" && newBankId) {
        const bankDoc = await banksCollection.doc(newBankId).get();
        if (!bankDoc.exists) throw new Error("Bank not found");

        const bankData = bankDoc.data();
        const currentBalance = Number(bankData.currentBalance || 0);
        if (currentBalance < newAmount) {
            throw new Error("Insufficient bank balance");
        }

        const newBalance = currentBalance - newAmount;

        await banksCollection.doc(newBankId).update({
            currentBalance: newBalance,
            closingBalance: newBalance,
            updatedAt: new Date().toISOString()
        });

        const txnRef = await banksCollection
            .doc(newBankId)
            .collection("transactions")
            .add({
                type: "DEBIT",
                amount: newAmount,
                projectNo: existingData.projectNo,
                labourId: existingData.labourId,
                remark: `Labour payment (switched to Bank): ${updateData.remark || existingData.remark || "N/A"}`,
                date: new Date().toISOString(),
                transactionType: "LABOUR_PAYMENT",
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                createdAt: new Date().toISOString(),
                relatedPaymentId: paymentId
            });

        updateData.bankTransactionId = txnRef.id;
        updateData.bankName = bankData.accountName || bankData.bankName || "Bank";
    }
    // CASE 3: BANK → CASH
    else if (oldMethod === "bank" && newMethod === "cash" && oldBankId) {
        const bankDoc = await banksCollection.doc(oldBankId).get();
        if (bankDoc.exists) {
            const bankData = bankDoc.data();
            const currentBalance = Number(bankData.currentBalance || 0);
            const newBalance = currentBalance + oldAmount;

            await banksCollection.doc(oldBankId).update({
                currentBalance: newBalance,
                closingBalance: newBalance,
                updatedAt: new Date().toISOString()
            });

            await banksCollection
                .doc(oldBankId)
                .collection("transactions")
                .add({
                    type: "CREDIT",
                    amount: oldAmount,
                    projectNo: existingData.projectNo,
                    labourId: existingData.labourId,
                    remark: `Labour payment reversed (switched to Cash): ${existingData.remark || "N/A"}`,
                    date: new Date().toISOString(),
                    transactionType: "LABOUR_PAYMENT_REVERSED",
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    createdAt: new Date().toISOString(),
                    relatedPaymentId: paymentId,
                    originalTransactionId: existingData.bankTransactionId
                });
        }

        updateData.bankId = null;
        updateData.bankName = null;
        updateData.bankTransactionId = null;
    }

    const cleanData = {
        ...updateData,
        updatedAt: new Date().toISOString()
    };

    // Only allow updating these fields
    delete cleanData.labourId;
    delete cleanData.projectNo;
    delete cleanData.date;
    delete cleanData.fromDate;
    delete cleanData.toDate;

    await docRef.update(cleanData);
    const updated = await docRef.get();

    return {
        paymentId: doc.id,
        ...updated.data()
    };
};

/**
 * Delete a labour payment
 */
exports.deleteLabourPayment = async (paymentId) => {
    const docRef = paymentsCollection.doc(paymentId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error("Payment record not found");
    }

    const paymentData = doc.data();
    const amount = Number(paymentData.amount) || 0;
    const method = (paymentData.method || "cash").toLowerCase();
    const bankId = paymentData.bankId;

    // 🏦 REVERSE BANK TRANSACTION
    if (method === "bank" && bankId && amount > 0) {
        const bankDoc = await banksCollection.doc(bankId).get();
        if (bankDoc.exists) {
            const bankData = bankDoc.data();
            const currentBalance = Number(bankData.currentBalance || 0);
            const newBalance = currentBalance + amount; // CREDIT back

            await banksCollection.doc(bankId).update({
                currentBalance: newBalance,
                closingBalance: newBalance,
                updatedAt: new Date().toISOString()
            });

            await banksCollection
                .doc(bankId)
                .collection("transactions")
                .add({
                    type: "CREDIT",
                    amount: amount,
                    projectNo: paymentData.projectNo,
                    labourId: paymentData.labourId,
                    remark: `Labour payment deleted: ${paymentData.remark || "N/A"}`,
                    date: new Date().toISOString(),
                    transactionType: "LABOUR_PAYMENT_DELETED",
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    createdAt: new Date().toISOString(),
                    relatedPaymentId: paymentId,
                    originalTransactionId: paymentData.bankTransactionId
                });
        }
    }

    await docRef.delete();

    return {
        message: "Labour payment deleted successfully",
        paymentId,
        reversedAmount: method === "bank" ? amount : 0
    };
};

module.exports = exports;