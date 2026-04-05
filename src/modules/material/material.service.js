const { db } = require("../../config/firebase");

const materialsCollection = db.collection("materials");
const materialReceivedCollection = db.collection("materialReceived");
const materialUsedCollection = db.collection("materialUsed");
const stockCollection = db.collection("stock");
const materialRequiredCollection = db.collection("materialRequired");
const materialPlanCollection = db.collection("materialPlan");
const siteExpensesCollection = db.collection("siteExpenses");
const banksCollection = db.collection("banks");
const dayjs = require("dayjs");

const getFormattedDate = (date) =>
    date ? dayjs(date).format("DD-MM-YYYY") : dayjs().format("DD-MM-YYYY");

// ─── Default Materials ────────────────────────────────────────────────────────

const DEFAULT_MATERIALS = [
    "MSAND", "PSAND", "RIVERSAND", "BRICKS", "FLYESH BRICKS",
    "RENACON BLOCKS", "CEMENT", "STEEL-8MM", "STEEL-6MM",
    "STEEL-10MM", "STEEL-12MM", "STEEL-16MM", "STEEL-20MM",
    "AGGREGATE-20MM", "AGGREGATE-40MM", "BABY CHIPS", "GRAVEL"
];

const initializeMaterials = async () => {
    try {
        const snap = await materialsCollection.limit(1).get();
        if (snap.empty) {
            const batch = db.batch();
            DEFAULT_MATERIALS.forEach(name => {
                const materialId = name.replace(/\s+/g, '_').toUpperCase();
                const docRef = materialsCollection.doc(materialId);
                batch.set(docRef, {
                    materialId,
                    materialName: name.toUpperCase(),
                    isDefault: true,
                    createdAt: new Date().toISOString()
                });
            });
            await batch.commit();
            console.log("Default materials initialized.");
        }
    } catch (error) {
        console.error("Failed to initialize materials:", error);
    }
};

initializeMaterials();

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Create a material expense (CASH payment)
 */
async function _createMaterialExpense(receiptId, receivedData, paidAmount) {
    const isoNow = new Date().toISOString();

    const expenseData = {
        projectNo: receivedData.projectNo,
        amount: paidAmount,
        particular: `Material Purchase: ${receivedData.materialName}`,
        remark: receivedData.dealerName ? `Material Purchase: ${receivedData.materialName} (Dealer: ${receivedData.dealerName})` : `Material Purchase: ${receivedData.materialName}`,
        type: "materialPayment",
        materialId: receivedData.materialId,
        receiptId,
        date: isoNow,
        createdAt: isoNow,
        paymentMethod: "CASH", // Explicitly mark as CASH
    };

    const snap = await siteExpensesCollection
        .where("projectNo", "==", receivedData.projectNo).get();
    let totalPrevious = 0;
    snap.forEach(doc => { totalPrevious += Number(doc.data().amount) || 0; });
    expenseData.pastExpense = totalPrevious;

    await siteExpensesCollection.add(expenseData);
}

/**
 * Create a material advance (BANK payment)
 * Updates bank balance and creates transaction record
 */
async function _createMaterialAdvance(receiptId, receivedData, paidAmount, paymentMethod, bankId, bankName) {
    if (paymentMethod !== "BANK" || !bankId) return;

    const isoNow = new Date().toISOString();

    // Update bank balance
    const bankDoc = await banksCollection.doc(bankId).get();
    if (!bankDoc.exists) {
        throw new Error(`Bank account with ID ${bankId} not found`);
    }

    const bankData = bankDoc.data();
    const currentBalance = Number(bankData.currentBalance || 0);
    const newBalance = currentBalance + paidAmount;

    await banksCollection.doc(bankId).update({
        currentBalance: newBalance,
        closingBalance: newBalance,
        updatedAt: isoNow
    });

    // Create transaction in subcollection: banks/{bankId}/transactions
    const transactionData = {
        type: "CREDIT",
        amount: paidAmount,
        projectNo: receivedData.projectNo,
        remark: `Material Purchase: ${receivedData.materialName}${receivedData.dealerName ? ` (Dealer: ${receivedData.dealerName})` : ''}`,
        date: receivedData.date || new Date().toISOString().split("T")[0],
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        transactionType: "MATERIAL_PAYMENT",
        createdAt: isoNow,
        relatedReceiptId: receiptId,
        materialId: receivedData.materialId,
        materialName: receivedData.materialName
    };

    const transactionRef = await banksCollection
        .doc(bankId)
        .collection("transactions")
        .add(transactionData);

    // Store bank transaction reference in receipt
    return {
        bankTransactionId: transactionRef.id,
        bankName: bankName || bankData.accountName || "Unknown Bank"
    };
}

/**
 * Update material expense (CASH payment)
 */
async function _updateMaterialExpense(receiptId, newPaidAmount) {
    const snap = await siteExpensesCollection
        .where("receiptId", "==", receiptId)
        .where("type", "==", "materialPayment")
        .where("paymentMethod", "==", "CASH")
        .get();
    if (snap.empty) return;
    const expenseRef = snap.docs[0].ref;
    if (newPaidAmount <= 0) {
        await expenseRef.delete();
    } else {
        await expenseRef.update({ amount: newPaidAmount, updatedAt: new Date().toISOString() });
    }
}

/**
 * Update material advance (BANK payment)
 */
async function _updateMaterialAdvance(receiptId, newPaidAmount, oldPaidAmount, bankId, oldBankId) {
    const isoNow = new Date().toISOString();

    // If bank unchanged, just adjust balance
    if (bankId === oldBankId && bankId) {
        const amountDifference = newPaidAmount - oldPaidAmount;
        const bankDoc = await banksCollection.doc(bankId).get();
        if (bankDoc.exists) {
            const bankData = bankDoc.data();
            const currentBalance = Number(bankData.currentBalance || 0);
            const newBalance = currentBalance + amountDifference;

            await banksCollection.doc(bankId).update({
                currentBalance: newBalance,
                closingBalance: newBalance,
                updatedAt: isoNow
            });

            // Create adjustment transaction
            if (amountDifference !== 0) {
                await banksCollection
                    .doc(bankId)
                    .collection("transactions")
                    .add({
                        type: amountDifference > 0 ? "CREDIT" : "DEBIT",
                        amount: Math.abs(amountDifference),
                        remark: `Material payment adjustment`,
                        date: new Date().toISOString().split("T")[0],
                        balanceBefore: currentBalance - amountDifference,
                        balanceAfter: newBalance,
                        transactionType: "MATERIAL_ADJUSTMENT",
                        createdAt: isoNow,
                        relatedReceiptId: receiptId
                    });
            }
        }
        return;
    }

    // If bank changed: revert old bank, add to new bank
    if (oldBankId && oldBankId !== bankId) {
        const oldBankDoc = await banksCollection.doc(oldBankId).get();
        if (oldBankDoc.exists) {
            const oldBankData = oldBankDoc.data();
            const oldBalance = Number(oldBankData.currentBalance || 0);
            const revertedBalance = oldBalance - oldPaidAmount;

            await banksCollection.doc(oldBankId).update({
                currentBalance: revertedBalance,
                closingBalance: revertedBalance,
                updatedAt: isoNow
            });

            // Create debit transaction in old bank
            await banksCollection
                .doc(oldBankId)
                .collection("transactions")
                .add({
                    type: "DEBIT",
                    amount: oldPaidAmount,
                    remark: `Material payment reversed`,
                    date: new Date().toISOString().split("T")[0],
                    balanceBefore: oldBalance,
                    balanceAfter: revertedBalance,
                    transactionType: "MATERIAL_REVERSED",
                    createdAt: isoNow,
                    relatedReceiptId: receiptId
                });
        }
    }

    // Add to new bank
    if (newPaidAmount > 0 && bankId) {
        const newBankDoc = await banksCollection.doc(bankId).get();
        if (newBankDoc.exists) {
            const newBankData = newBankDoc.data();
            const newBalance = Number(newBankData.currentBalance || 0) + newPaidAmount;

            await banksCollection.doc(bankId).update({
                currentBalance: newBalance,
                closingBalance: newBalance,
                updatedAt: isoNow
            });

            // Create credit transaction in new bank
            await banksCollection
                .doc(bankId)
                .collection("transactions")
                .add({
                    type: "CREDIT",
                    amount: newPaidAmount,
                    remark: `Material payment from bank change`,
                    date: new Date().toISOString().split("T")[0],
                    balanceBefore: Number(newBankData.currentBalance || 0),
                    balanceAfter: newBalance,
                    transactionType: "MATERIAL_PAYMENT",
                    createdAt: isoNow,
                    relatedReceiptId: receiptId
                });
        }
    }
}

/**
 * Delete material expense (CASH payment)
 */
async function _deleteMaterialExpense(receiptId) {
    const snap = await siteExpensesCollection
        .where("receiptId", "==", receiptId)
        .where("type", "==", "materialPayment")
        .where("paymentMethod", "==", "CASH")
        .get();
    await Promise.all(snap.docs.map(doc => doc.ref.delete()));
}

/**
 * Delete material advance (BANK payment)
 */
async function _deleteMaterialAdvance(receiptId, paidAmount, bankId) {
    if (!bankId) return;

    const isoNow = new Date().toISOString();
    const bankDoc = await banksCollection.doc(bankId).get();
    if (bankDoc.exists) {
        const bankData = bankDoc.data();
        const currentBalance = Number(bankData.currentBalance || 0);
        const newBalance = Math.max(0, currentBalance - paidAmount);

        await banksCollection.doc(bankId).update({
            currentBalance: newBalance,
            closingBalance: newBalance,
            updatedAt: isoNow
        });

        // Create debit transaction
        await banksCollection
            .doc(bankId)
            .collection("transactions")
            .add({
                type: "DEBIT",
                amount: paidAmount,
                remark: `Material payment deleted`,
                date: new Date().toISOString().split("T")[0],
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                transactionType: "MATERIAL_DELETED",
                createdAt: isoNow,
                relatedReceiptId: receiptId
            });
    }
}

// ─── Material Master ──────────────────────────────────────────────────────────

exports.createMaterial = async (materialData) => {
    if (!materialData.materialId) throw new Error("materialId is required");
    const docRef = materialsCollection.doc(materialData.materialId);
    const doc = await docRef.get();
    if (doc.exists) throw new Error("Material with this materialId already exists");
    await docRef.set(materialData);
    return materialData;
};

exports.getMaterials = async () => {
    const snapshot = await materialsCollection.orderBy("materialName", "asc").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// ─── Material Received ────────────────────────────────────────────────────────

/**
 * Record material received with CASH or BANK payment
 * Frontend passes:
 * {
 *   projectNo, materialId, materialName, quantity, rate, paidAmount, dealerName,
 *   date, paymentMethod ("CASH" | "BANK"), bankId?, bankName?
 * }
 */
exports.recordMaterialReceived = async (receivedData) => {
    const normalizedId = receivedData.materialId ? receivedData.materialId.trim().toUpperCase() : null;
    const normalizedName = receivedData.materialName ? receivedData.materialName.trim().toUpperCase() : null;

    if (!receivedData.projectNo || !normalizedId) throw new Error("projectNo and materialId are required");
    if (!normalizedName) throw new Error("materialName is required");
    if (!receivedData.paymentMethod || !["CASH", "BANK"].includes(receivedData.paymentMethod)) {
        throw new Error("paymentMethod must be 'CASH' or 'BANK'");
    }

    // Ensure material exists in master list
    const matRef = materialsCollection.doc(normalizedId);
    const matDoc = await matRef.get();
    if (!matDoc.exists) {
        await matRef.set({
            materialId: normalizedId,
            materialName: normalizedName,
            isDefault: false,
            createdAt: new Date().toISOString()
        });
    }

    // Stock consistency check
    const stockId = `${receivedData.projectNo}_${normalizedId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    if (stockDoc.exists) {
        const existingName = stockDoc.data().materialName;
        if (existingName.toUpperCase() !== normalizedName) {
            throw new Error(`Material ID '${normalizedId}' already registered as '${existingName}'.`);
        }
    }

    const receiptDate = getFormattedDate(receivedData.date);
    const quantity = Number(receivedData.quantity) || 0;
    const rate = Number(receivedData.rate) || 0;
    const paidAmount = Number(receivedData.paidAmount) || 0;
    const totalAmount = quantity * rate;

    const finalData = {
        ...receivedData,
        materialId: normalizedId,
        materialName: normalizedName,
        date: receiptDate,
        quantity,
        rate,
        totalAmount,
        paidAmount,
        dueAmount: Math.max(0, totalAmount - paidAmount),
        paymentMethod: receivedData.paymentMethod,
        createdAt: new Date().toISOString()
    };

    // Handle BANK payment
    if (receivedData.paymentMethod === "BANK") {
        if (!receivedData.bankId) {
            throw new Error("bankId is required for BANK payment method");
        }
        if (paidAmount > 0) {
            const advanceData = await _createMaterialAdvance(
                null, // receiptId will be set after doc is created
                finalData,
                paidAmount,
                receivedData.paymentMethod,
                receivedData.bankId,
                receivedData.bankName
            );
            finalData.bankId = receivedData.bankId;
            finalData.bankName = advanceData.bankName;
            finalData.bankTransactionId = advanceData.bankTransactionId;
        }
    }

    const docRef = await materialReceivedCollection.add(finalData);
    const receiptId = docRef.id;

    // Update bankTransactionId if BANK payment (now that we have receiptId)
    if (receivedData.paymentMethod === "BANK" && finalData.bankTransactionId) {
        await banksCollection
            .doc(receivedData.bankId)
            .collection("transactions")
            .doc(finalData.bankTransactionId)
            .update({ relatedReceiptId: receiptId });
    }

    // Stock update
    if (stockDoc.exists) {
        const s = stockDoc.data();
        await stockRef.update({
            receivedQuantity: (Number(s.receivedQuantity) || 0) + quantity,
            stock: (Number(s.stock) || 0) + quantity,
            updatedAt: receiptDate
        });
    } else {
        await stockRef.set({
            projectNo: finalData.projectNo,
            materialId: normalizedId,
            materialName: normalizedName,
            receivedQuantity: quantity,
            usedQuantity: 0,
            stock: quantity,
            createdAt: receiptDate
        });
    }

    // Handle CASH payment (legacy expense record)
    if (receivedData.paymentMethod === "CASH" && paidAmount > 0) {
        await _createMaterialExpense(receiptId, finalData, paidAmount);
    }

    return { receiptId, ...finalData };
};

exports.getMaterialReceived = async (projectNo) => {
    let query = materialReceivedCollection;
    if (projectNo) query = query.where("projectNo", "==", projectNo);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ receiptId: doc.id, ...doc.data() }));
};

exports.getMaterialReceivedByMaterialId = async (materialId) => {
    const snapshot = await materialReceivedCollection
        .where("materialId", "==", materialId).get();
    if (snapshot.empty) throw new Error(`No received records found for material ID '${materialId}'`);
    return snapshot.docs.map(doc => ({ receiptId: doc.id, ...doc.data() }));
};

/**
 * Update receipt payment (handles both CASH and BANK)
 * Frontend passes: { paidAmount, paymentMethod?, bankId?, bankName? }
 */
exports.updateReceiptPayment = async (receiptId, paymentData) => {
    const docRef = materialReceivedCollection.doc(receiptId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Receipt not found");

    const newPaidAmount = Number(paymentData.paidAmount) || 0;
    const oldData = doc.data();
    const oldPaymentMethod = oldData.paymentMethod || "CASH";
    const newPaymentMethod = paymentData.paymentMethod || oldPaymentMethod;
    const totalAmount = Number(oldData.totalAmount) || 0;
    const oldPaidAmount = Number(oldData.paidAmount) || 0;
    const oldBankId = oldData.bankId;
    const newBankId = paymentData.bankId;

    await docRef.update({
        paidAmount: newPaidAmount,
        dueAmount: Math.max(0, totalAmount - newPaidAmount),
        paymentMethod: newPaymentMethod,
        bankId: newBankId,
        bankName: paymentData.bankName
    });

    // Handle payment method change or amount change
    if (oldPaymentMethod === "CASH") {
        if (newPaymentMethod === "BANK") {
            // CASH to BANK: delete expense, create advance
            await _deleteMaterialExpense(receiptId);
            if (newPaidAmount > 0 && newBankId) {
                const advanceData = await _createMaterialAdvance(
                    receiptId,
                    oldData,
                    newPaidAmount,
                    newPaymentMethod,
                    newBankId,
                    paymentData.bankName
                );
                await docRef.update({
                    bankTransactionId: advanceData.bankTransactionId,
                    bankName: advanceData.bankName
                });
            }
        } else {
            // CASH to CASH: update expense
            if (newPaidAmount !== oldPaidAmount) {
                await _updateMaterialExpense(receiptId, newPaidAmount);
            }
        }
    } else if (oldPaymentMethod === "BANK") {
        if (newPaymentMethod === "CASH") {
            // BANK to CASH: revert advance, create expense
            if (oldPaidAmount > 0 && oldBankId) {
                await _deleteMaterialAdvance(receiptId, oldPaidAmount, oldBankId);
            }
            if (newPaidAmount > 0) {
                await _createMaterialExpense(receiptId, oldData, newPaidAmount);
            }
        } else {
            // BANK to BANK: update advance
            if (newPaidAmount !== oldPaidAmount || newBankId !== oldBankId) {
                await _updateMaterialAdvance(receiptId, newPaidAmount, oldPaidAmount, newBankId, oldBankId);
            }
        }
    }

    const updatedDoc = await docRef.get();
    return { receiptId: updatedDoc.id, ...updatedDoc.data() };
};

exports.updateMaterialReceived = async (receiptId, updateData) => {
    const docRef = materialReceivedCollection.doc(receiptId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Receipt not found");

    const oldData = doc.data();
    const oldQty = Number(oldData.quantity) || 0;
    const newQty = updateData.quantity !== undefined ? Number(updateData.quantity) : oldQty;

    const newRate = updateData.rate !== undefined
        ? Number(updateData.rate)
        : (Number(oldData.rate) || 0);

    const newTotalAmount = newQty * newRate;
    const oldPaidAmount = Number(oldData.paidAmount) || 0;
    const newPaidAmount = updateData.paidAmount !== undefined
        ? Number(updateData.paidAmount)
        : oldPaidAmount;

    const newPaymentMethod = updateData.paymentMethod || oldData.paymentMethod || "CASH";
    const newBankId = updateData.bankId || oldData.bankId;

    const updatedRecord = {
        ...updateData,
        quantity: newQty,
        rate: newRate,
        totalAmount: newTotalAmount,
        paidAmount: newPaidAmount,
        dueAmount: Math.max(0, newTotalAmount - newPaidAmount),
        paymentMethod: newPaymentMethod,
        bankId: newBankId,
        updatedAt: new Date().toISOString(),
    };

    // Stock diff-based update
    const qtyDiff = newQty - oldQty;
    if (qtyDiff !== 0) {
        const stockId = `${oldData.projectNo}_${oldData.materialId}`;
        const stockRef = stockCollection.doc(stockId);
        const stockDoc = await stockRef.get();
        if (stockDoc.exists) {
            const s = stockDoc.data();
            await stockRef.update({
                receivedQuantity: Math.max(0, (Number(s.receivedQuantity) || 0) + qtyDiff),
                stock: Math.max(0, (Number(s.stock) || 0) + qtyDiff),
                updatedAt: new Date().toISOString(),
            });
        }
    }

    // Handle payment amount change
    if (newPaidAmount !== oldPaidAmount) {
        const oldPaymentMethod = oldData.paymentMethod || "CASH";

        if (oldPaymentMethod === "CASH" && newPaymentMethod === "CASH") {
            await _updateMaterialExpense(receiptId, newPaidAmount);
        } else if (oldPaymentMethod === "BANK" && newPaymentMethod === "BANK") {
            await _updateMaterialAdvance(receiptId, newPaidAmount, oldPaidAmount, newBankId, oldData.bankId);
        } else if (oldPaymentMethod === "CASH" && newPaymentMethod === "BANK") {
            await _deleteMaterialExpense(receiptId);
            if (newPaidAmount > 0) {
                const advanceData = await _createMaterialAdvance(
                    receiptId,
                    oldData,
                    newPaidAmount,
                    newPaymentMethod,
                    newBankId,
                    updateData.bankName
                );
                updatedRecord.bankTransactionId = advanceData.bankTransactionId;
                updatedRecord.bankName = advanceData.bankName;
            }
        } else if (oldPaymentMethod === "BANK" && newPaymentMethod === "CASH") {
            if (oldPaidAmount > 0 && oldData.bankId) {
                await _deleteMaterialAdvance(receiptId, oldPaidAmount, oldData.bankId);
            }
            if (newPaidAmount > 0) {
                await _createMaterialExpense(receiptId, oldData, newPaidAmount);
            }
        }
    }

    const cleanRecord = Object.fromEntries(
        Object.entries(updatedRecord).filter(([_, v]) => v !== undefined)
    );
    await docRef.update(cleanRecord);

    const updatedDoc = await docRef.get();
    return { receiptId: updatedDoc.id, ...updatedDoc.data() };
};

exports.deleteMaterialReceived = async (receiptId) => {
    const docRef = materialReceivedCollection.doc(receiptId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Receipt not found");

    const data = doc.data();
    const quantity = Number(data.quantity) || 0;
    const paidAmount = Number(data.paidAmount) || 0;
    const paymentMethod = data.paymentMethod || "CASH";
    const bankId = data.bankId;

    // Update stock
    const stockId = `${data.projectNo}_${data.materialId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    if (stockDoc.exists && quantity > 0) {
        const s = stockDoc.data();
        await stockRef.update({
            receivedQuantity: Math.max(0, (s.receivedQuantity || 0) - quantity),
            stock: Math.max(0, (s.stock || 0) - quantity),
        });
    }

    // Revert payments based on method
    if (paymentMethod === "CASH" && paidAmount > 0) {
        await _deleteMaterialExpense(receiptId);
    } else if (paymentMethod === "BANK" && paidAmount > 0 && bankId) {
        await _deleteMaterialAdvance(receiptId, paidAmount, bankId);
    }

    await docRef.delete();
    return { message: "Material receipt deleted and stock/expense restored", receiptId };
};

// ─── Material Used ────────────────────────────────────────────────────────────

exports.recordMaterialUsed = async (usedData) => {
    const normalizedId = usedData.materialId ? usedData.materialId.trim().toUpperCase() : null;

    if (!usedData.projectNo || !normalizedId)
        throw new Error("projectNo and materialId are required");

    const qtyUsed = Number(usedData.quantityUsed) || 0;
    const stockId = `${usedData.projectNo}_${normalizedId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    if (!stockDoc.exists)
        throw new Error(`Material '${normalizedId}' not found in stock. Please receive it first.`);

    const currentStock = stockDoc.data();
    const availableStock = Number(currentStock.stock) || 0;

    if (qtyUsed > availableStock) {
        throw new Error(
            `Stock is ${availableStock}, you cannot use ${qtyUsed}. ` +
            `Please add material received first.`
        );
    }

    const usedDate = getFormattedDate(usedData.date);

    const finalUsedData = {
        ...usedData,
        materialId: normalizedId,
        materialName: currentStock.materialName,
        quantityUsed: qtyUsed,
        createdAt: usedDate,
    };

    const docRef = await materialUsedCollection.add(finalUsedData);

    await stockRef.update({
        usedQuantity: (Number(currentStock.usedQuantity) || 0) + qtyUsed,
        stock: availableStock - qtyUsed,
        updatedAt: usedDate,
    });

    return { usageId: docRef.id, ...finalUsedData };
};

exports.deleteMaterialUsed = async (usageId) => {
    const docRef = materialUsedCollection.doc(usageId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Material used record not found");

    const data = doc.data();
    const qtyUsed = Number(data.quantityUsed) || 0;
    const stockId = `${data.projectNo}_${data.materialId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    if (stockDoc.exists && qtyUsed > 0) {
        const s = stockDoc.data();
        await stockRef.update({
            usedQuantity: Math.max(0, (Number(s.usedQuantity) || 0) - qtyUsed),
            stock: (Number(s.stock) || 0) + qtyUsed,
        });
    }

    await docRef.delete();
    return { message: "Material used record deleted and stock restored", usageId };
};

// ─── Material Stock ───────────────────────────────────────────────────────────

exports.getMaterialStock = async (projectNo) => {
    let snap;
    if (projectNo) {
        snap = await stockCollection.where("projectNo", "==", projectNo).get();
    } else {
        snap = await stockCollection.get();
    }
    return snap.docs.map(doc => doc.data());
};

// ─── Material Required ────────────────────────────────────────────────────────

exports.addMaterialRequired = async (data) => {
    if (!data.projectNo || !data.materialId) throw new Error("projectNo and materialId are required");
    if (!data.materialName) throw new Error("materialName is required");

    const qty = Number(data.requiredQuantity) || 0;
    if (qty <= 0) throw new Error("requiredQuantity must be a positive number");

    const existingSnap = await materialRequiredCollection
        .where("projectNo", "==", data.projectNo)
        .where("materialId", "==", data.materialId)
        .get();

    let requiredDocId, newRequiredQuantity;

    if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const currentQty = Number(existingDoc.data().requiredQuantity) || 0;
        newRequiredQuantity = currentQty + qty;
        await existingDoc.ref.update({
            requiredQuantity: newRequiredQuantity,
            updatedAt: new Date().toISOString(),
        });
        requiredDocId = existingDoc.id;
    } else {
        newRequiredQuantity = qty;
        data.createdAt = new Date().toISOString();
        data.requiredQuantity = qty;
        const docRef = await materialRequiredCollection.add(data);
        requiredDocId = docRef.id;
    }

    return {
        id: requiredDocId,
        projectNo: data.projectNo,
        materialId: data.materialId,
        materialName: data.materialName,
        requiredQuantity: newRequiredQuantity,
    };
};

exports.getAllMaterialRequired = async () => {
    const snap = await materialRequiredCollection.get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

exports.getMaterialRequired = async (projectNo) => {
    const [planSnap, stockSnap] = await Promise.all([
        materialPlanCollection.where("projectNo", "==", projectNo).get(),
        stockCollection.where("projectNo", "==", projectNo).get(),
    ]);

    const stocks = stockSnap.docs.map(doc => doc.data());

    return planSnap.docs.map(doc => {
        const plan = doc.data();
        const stockItem = stocks.find(s => s.materialId === plan.materialId);
        const stock = stockItem ? stockItem.stock : 0;
        const plannedQty = Number(plan.plannedQuantity) || 0;
        const required = plannedQty - stock;
        return {
            materialId: plan.materialId,
            materialName: plan.materialName,
            plannedQuantity: plannedQty,
            stock,
            materialRequired: required > 0 ? required : 0,
        };
    });
};