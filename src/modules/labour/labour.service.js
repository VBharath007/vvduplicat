const { db } = require("../../config/firebase");
const dayjs = require("dayjs");

const labourMasterCollection = db.collection("labourMaster");
const labourTypesCollection = db.collection("labourTypes");
const labourPaymentsCollection = db.collection("labourPayments");

const now = () => dayjs().format("DD-MM-YY HH:mm");

// ═══════════════════════════════════════════════════════════════════════════
// LABOUR MASTER CRUD
// ═══════════════════════════════════════════════════════════════════════════

exports.addLabourMaster = async (labourData) => {
    if (!labourData.name || !labourData.name.trim()) {
        throw new Error("Labour name is required");
    }

    const payload = {
        name: labourData.name.trim(),
        contact: labourData.contact || "N/A",
        createdAt: now(),
        updatedAt: now(),
    };

    const docRef = await labourMasterCollection.add(payload);
    return { id: docRef.id, ...payload };
};

exports.getLabourMasters = async () => {
    const snapshot = await labourMasterCollection.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

exports.getLabourMasterById = async (labourId) => {
    const doc = await labourMasterCollection.doc(labourId).get();
    if (!doc.exists) {
        throw new Error(`Labour master '${labourId}' not found`);
    }
    return { id: doc.id, ...doc.data() };
};

exports.getLabourMasterByName = async (name) => {
    if (!name || !name.trim()) {
        throw new Error("Labour name is required");
    }

    const snapshot = await labourMasterCollection
        .where("name", "==", name.trim())
        .limit(1)
        .get();

    if (snapshot.empty) {
        throw new Error(`Labour master with name '${name}' not found`);
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
};

exports.updateLabourMaster = async (labourId, updateData) => {
    const docRef = labourMasterCollection.doc(labourId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error(`Labour master '${labourId}' not found`);
    }

    delete updateData.id;
    delete updateData.createdAt;
    updateData.updatedAt = now();

    if (updateData.name) {
        updateData.name = updateData.name.trim();
    }

    await docRef.update(updateData);
    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() };
};

exports.deleteLabourMaster = async (labourId) => {
    const docRef = labourMasterCollection.doc(labourId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error(`Labour master '${labourId}' not found`);
    }

    await docRef.delete();
    return { message: "Labour master deleted successfully" };
};

// ═══════════════════════════════════════════════════════════════════════════
// LABOUR TYPES / SUB-LABOUR CRUD
// ═══════════════════════════════════════════════════════════════════════════

exports.addSubLabourType = async (typeData) => {
    if (!typeData.typeName || !typeData.typeName.trim()) {
        throw new Error("Type name is required");
    }

    const payload = {
        typeName: typeData.typeName.trim().toUpperCase(),
        description: typeData.description || "",
        createdAt: now(),
        updatedAt: now(),
    };

    const docRef = await labourTypesCollection.add(payload);
    return { id: docRef.id, ...payload };
};

exports.getSubLabourTypes = async () => {
    const snapshot = await labourTypesCollection.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

exports.getSubLabourTypeById = async (typeId) => {
    const doc = await labourTypesCollection.doc(typeId).get();
    if (!doc.exists) {
        throw new Error(`Labour type '${typeId}' not found`);
    }
    return { id: doc.id, ...doc.data() };
};

exports.updateSubLabourType = async (typeId, updateData) => {
    const docRef = labourTypesCollection.doc(typeId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error(`Labour type '${typeId}' not found`);
    }

    delete updateData.id;
    delete updateData.createdAt;
    updateData.updatedAt = now();

    if (updateData.typeName) {
        updateData.typeName = updateData.typeName.trim().toUpperCase();
    }

    await docRef.update(updateData);
    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() };
};

exports.deleteSubLabourType = async (typeId) => {
    const docRef = labourTypesCollection.doc(typeId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error(`Labour type '${typeId}' not found`);
    }

    await docRef.delete();
    return { message: "Labour type deleted successfully" };
};

// ═══════════════════════════════════════════════════════════════════════════
// LABOUR PAYMENTS - INTEGRATED INTO LABOUR MODULE
// ═══════════════════════════════════════════════════════════════════════════

exports.recordLabourPayment = async (labourId, projectNo, paymentData) => {
    const { amount, method, bankId, fromDate, toDate, remark } = paymentData;

    if (!labourId || !projectNo) {
        throw new Error("labourId and projectNo are required");
    }

    if (!amount || amount <= 0) {
        throw new Error("Valid amount is required");
    }

    if (!method || !["cash", "bank"].includes(method)) {
        throw new Error("Payment method must be 'cash' or 'bank'");
    }

    // If bank payment, validate bank and debit balance
    let bankName = null;
    let bankTransactionId = null;

    if (method === "bank") {
        if (!bankId) {
            throw new Error("Bank ID is required for bank payments");
        }

        const bankRef = db.collection("banks").doc(bankId);
        const bankDoc = await bankRef.get();

        if (!bankDoc.exists) {
            throw new Error(`Bank '${bankId}' not found`);
        }

        const bankData = bankDoc.data();
        bankName = bankData.bankName;
        const currentBalance = bankData.balance || 0;

        if (currentBalance < amount) {
            throw new Error(`Insufficient bank balance. Available: ${currentBalance}, Required: ${amount}`);
        }

        // Debit bank balance
        await bankRef.update({
            balance: currentBalance - amount,
            updatedAt: now(),
        });

        // Create transaction record
        const txnRef = await bankRef.collection("transactions").add({
            type: "debit",
            amount: amount,
            description: `Labour payment to ${labourId} for project ${projectNo}`,
            labourId: labourId,
            projectNo: projectNo,
            date: dayjs().format("DD-MM-YYYY"),
            createdAt: now(),
        });

        bankTransactionId = txnRef.id;
    }

    const payload = {
        labourId,
        projectNo,
        amount,
        method,
        bankId: method === "bank" ? bankId : null,
        bankName: method === "bank" ? bankName : null,
        bankTransactionId: method === "bank" ? bankTransactionId : null,
        fromDate: fromDate || dayjs().format("DD-MM-YYYY"),
        toDate: toDate || dayjs().format("DD-MM-YYYY"),
        remark: remark || "",
        date: dayjs().format("DD-MM-YYYY"),
        createdAt: now(),
        updatedAt: now(),
    };

    const docRef = await labourPaymentsCollection.add(payload);
    return { id: docRef.id, ...payload };
};

exports.getLabourPaymentsByProject = async (labourId, projectNo) => {
    const snapshot = await labourPaymentsCollection
        .where("labourId", "==", labourId)
        .where("projectNo", "==", projectNo)
        .orderBy("date", "desc")
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

exports.getLabourPayments = async (labourId) => {
    const snapshot = await labourPaymentsCollection
        .where("labourId", "==", labourId)
        .orderBy("date", "desc")
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

exports.getPaymentById = async (paymentId) => {
    const doc = await labourPaymentsCollection.doc(paymentId).get();

    if (!doc.exists) {
        throw new Error(`Payment '${paymentId}' not found`);
    }

    return { id: doc.id, ...doc.data() };
};

exports.updateLabourPayment = async (paymentId, updateData) => {
    const docRef = labourPaymentsCollection.doc(paymentId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error(`Payment '${paymentId}' not found`);
    }

    const oldData = doc.data();
    delete updateData.id;
    delete updateData.createdAt;
    updateData.updatedAt = now();

    // Handle bank payment changes
    if (updateData.method && updateData.method !== oldData.method) {
        const oldAmount = oldData.amount;
        const newAmount = updateData.amount || oldAmount;

        // Old payment was bank → reverse it
        if (oldData.method === "bank" && oldData.bankId && oldData.bankTransactionId) {
            const oldBankRef = db.collection("banks").doc(oldData.bankId);
            const oldBankDoc = await oldBankRef.get();

            if (oldBankDoc.exists) {
                const oldBalance = oldBankDoc.data().balance || 0;
                await oldBankRef.update({
                    balance: oldBalance + oldAmount,
                    updatedAt: now(),
                });

                // Mark old transaction as reversed
                await oldBankRef.collection("transactions").doc(oldData.bankTransactionId).update({
                    reversed: true,
                    reversedAt: now(),
                });
            }
        }

        // New payment is bank → debit new bank
        if (updateData.method === "bank" && updateData.bankId) {
            const newBankRef = db.collection("banks").doc(updateData.bankId);
            const newBankDoc = await newBankRef.get();

            if (!newBankDoc.exists) {
                throw new Error(`Bank '${updateData.bankId}' not found`);
            }

            const newBankData = newBankDoc.data();
            const currentBalance = newBankData.balance || 0;

            if (currentBalance < newAmount) {
                throw new Error(`Insufficient bank balance. Available: ${currentBalance}, Required: ${newAmount}`);
            }

            await newBankRef.update({
                balance: currentBalance - newAmount,
                updatedAt: now(),
            });

            const txnRef = await newBankRef.collection("transactions").add({
                type: "debit",
                amount: newAmount,
                description: `Updated labour payment to ${oldData.labourId}`,
                labourId: oldData.labourId,
                projectNo: oldData.projectNo,
                date: dayjs().format("DD-MM-YYYY"),
                createdAt: now(),
            });

            updateData.bankId = updateData.bankId;
            updateData.bankName = newBankData.bankName;
            updateData.bankTransactionId = txnRef.id;
        } else {
            updateData.bankId = null;
            updateData.bankName = null;
            updateData.bankTransactionId = null;
        }
    } else if (updateData.amount && updateData.amount !== oldData.amount && oldData.method === "bank") {
        // Amount changed but method stays bank
        const difference = updateData.amount - oldData.amount;

        if (oldData.bankId) {
            const bankRef = db.collection("banks").doc(oldData.bankId);
            const bankDoc = await bankRef.get();

            if (bankDoc.exists) {
                const balance = bankDoc.data().balance || 0;

                if (difference > 0 && balance < difference) {
                    throw new Error(`Insufficient bank balance for increase`);
                }

                await bankRef.update({
                    balance: balance - difference,
                    updatedAt: now(),
                });
            }
        }
    }

    await docRef.update(updateData);
    const updated = await docRef.get();
    return { id: updated.id, ...updated.data() };
};

exports.deleteLabourPayment = async (paymentId) => {
    const docRef = labourPaymentsCollection.doc(paymentId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error(`Payment '${paymentId}' not found`);
    }

    const paymentData = doc.data();

    // If bank payment, reverse the transaction
    if (paymentData.method === "bank" && paymentData.bankId && paymentData.bankTransactionId) {
        const bankRef = db.collection("banks").doc(paymentData.bankId);
        const bankDoc = await bankRef.get();

        if (bankDoc.exists) {
            const balance = bankDoc.data().balance || 0;
            await bankRef.update({
                balance: balance + paymentData.amount,
                updatedAt: now(),
            });

            // Mark transaction as reversed
            await bankRef.collection("transactions").doc(paymentData.bankTransactionId).update({
                reversed: true,
                reversedAt: now(),
            });
        }
    }

    await docRef.delete();
    return { message: "Payment deleted successfully" };
};

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT-LABOUR LINKAGE (Helper for Work Service)
// ═══════════════════════════════════════════════════════════════════════════

exports.getLabourProjectHistory = async (labourId) => {
    if (!labourId) {
        throw new Error("labourId is required");
    }

    // Fetch master to verify it exists
    await this.getLabourMasterById(labourId);

    // Get all payments for this labour across all projects
    const payments = await labourPaymentsCollection
        .where("labourId", "==", labourId)
        .get();

    if (payments.empty) {
        return [];
    }

    // Group by project
    const projectMap = {};
    payments.docs.forEach(doc => {
        const data = doc.data();
        const projectNo = data.projectNo;

        if (!projectMap[projectNo]) {
            projectMap[projectNo] = {
                projectNo,
                totalPaid: 0,
                paymentCount: 0,
                payments: [],
            };
        }

        projectMap[projectNo].totalPaid += data.amount;
        projectMap[projectNo].paymentCount += 1;
        projectMap[projectNo].payments.push({ id: doc.id, ...data });
    });

    return Object.values(projectMap);
};