const { db } = require("../../config/firebase");

const materialsCollection = db.collection("materials");
const materialReceivedCollection = db.collection("materialReceived");
const materialUsedCollection = db.collection("materialUsed");
const stockCollection = db.collection("stock");
const materialRequiredCollection = db.collection("materialRequired");
const materialPlanCollection = db.collection("materialPlan");
const siteExpensesCollection = db.collection("siteExpenses"); // ← NEW: needed for auto-expense on material payment

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPER: Auto-create / update / delete a siteExpense entry that
// mirrors the paidAmount on a material receipt.
//
//  WHY: When the user receives materials and pays the supplier upfront
//       (paidAmount > 0), that payment IS a site expense. Recording it here
//       automatically keeps the financial summary accurate without requiring
//       the user to manually enter it again in the expense screen.
//
//  HOW IT IS LINKED:
//       siteExpenses doc gets   → type       : "materialPayment"
//                               → receiptId  : <materialReceived doc id>
//                               → materialId : <materialId>
//  This link lets us UPDATE or DELETE the expense when the receipt changes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a siteExpense for the material payment (paidAmount).
 * Called only when paidAmount > 0.
 */
async function _createMaterialExpense(receiptId, receivedData, paidAmount) {
    const expenseData = {
        projectNo: receivedData.projectNo,
        amount: paidAmount,
        particular: `Material Payment – ${receivedData.materialName}`,
        remark: `Material Payment – ${receivedData.materialName} (Receipt: ${receiptId})`,
        type: "materialPayment",   // distinguishes from manual site expenses
        materialId: receivedData.materialId,
        receiptId: receiptId,           // FK back to materialReceived doc
        date: receivedData.date,
        createdAt: new Date().toISOString(),
    };

    // Recalculate pastExpense from DB (same pattern as createExpense)
    const snap = await siteExpensesCollection
        .where("projectNo", "==", receivedData.projectNo).get();
    let totalPrevious = 0;
    snap.forEach(doc => { totalPrevious += Number(doc.data().amount) || 0; });
    expenseData.pastExpense = totalPrevious;

    await siteExpensesCollection.add(expenseData);
}

/**
 * Update the linked siteExpense when paidAmount changes on a receipt.
 * If newPaidAmount = 0, the expense entry is deleted entirely.
 */
async function _updateMaterialExpense(receiptId, newPaidAmount) {
    const snap = await siteExpensesCollection
        .where("receiptId", "==", receiptId)
        .where("type", "==", "materialPayment")
        .get();

    if (snap.empty) return; // nothing to update

    const expenseRef = snap.docs[0].ref;

    if (newPaidAmount <= 0) {
        await expenseRef.delete();
    } else {
        await expenseRef.update({
            amount: newPaidAmount,
            updatedAt: new Date().toISOString(),
        });
    }
}

/**
 * Delete the linked siteExpense when a material receipt is deleted.
 */
async function _deleteMaterialExpense(receiptId) {
    const snap = await siteExpensesCollection
        .where("receiptId", "==", receiptId)
        .where("type", "==", "materialPayment")
        .get();

    const deletes = snap.docs.map(doc => doc.ref.delete());
    await Promise.all(deletes);
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
    const snapshot = await materialsCollection.get();
    const materials = [];
    snapshot.forEach((doc) => materials.push(doc.data()));
    return materials;
};


// ─── Material Received ────────────────────────────────────────────────────────

exports.recordMaterialReceived = async (receivedData) => {
    if (!receivedData.projectNo || !receivedData.materialId)
        throw new Error("projectNo and materialId are required");
    if (!receivedData.materialName)
        throw new Error("materialName is required");

    // ── Name-consistency check across stock ──────────────────────────────────
    const stockId = `${receivedData.projectNo}_${receivedData.materialId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    if (stockDoc.exists) {
        const existingName = stockDoc.data().materialName;
        if (existingName.toLowerCase() !== receivedData.materialName.toLowerCase()) {
            throw new Error(
                `Material ID '${receivedData.materialId}' was already purchased as '${existingName}'. ` +
                `To add '${receivedData.materialName}' use a different material ID (e.g. MAT002).`
            );
        }
    }

    // ── Dedup guard ───────────────────────────────────────────────────────────
    // Same project + material + date + quantity within the same day → skip insert.
    const receiptDate = receivedData.date || new Date().toISOString().split("T")[0];
    const quantity = Number(receivedData.quantity) || 0;

    const dupSnap = await materialReceivedCollection
        .where("projectNo", "==", receivedData.projectNo)
        .where("materialId", "==", receivedData.materialId)
        .where("date", "==", receiptDate)
        .where("quantity", "==", quantity)
        .get();

    if (!dupSnap.empty) {
        const existing = dupSnap.docs[0];
        return { receiptId: existing.id, ...existing.data() };
    }

    // ── Prepare & save the receipt ────────────────────────────────────────────
    const rate = Number(receivedData.rate) || 0;
    const paidAmount = Number(receivedData.paidAmount) || 0;
    const totalAmount = quantity * rate;

    receivedData.createdAt = new Date().toISOString();
    receivedData.date = receiptDate;
    receivedData.quantity = quantity;
    receivedData.rate = rate;
    receivedData.totalAmount = totalAmount;   // full value of this receipt
    receivedData.paidAmount = paidAmount;    // amount already paid (advance to supplier)
    receivedData.dueAmount = totalAmount - paidAmount; // outstanding due to supplier

    const docRef = await materialReceivedCollection.add(receivedData);
    const receiptId = docRef.id;

    // ── Update / create stock ─────────────────────────────────────────────────
    if (stockDoc.exists) {
        const s = stockDoc.data();
        await stockRef.update({
            receivedQuantity: (s.receivedQuantity || 0) + quantity,
            stock: (s.stock || 0) + quantity,
        });
    } else {
        await stockRef.set({
            projectNo: receivedData.projectNo,
            materialId: receivedData.materialId,
            materialName: receivedData.materialName,
            receivedQuantity: quantity,
            usedQuantity: 0,
            stock: quantity,
        });
    }

    // ── AUTO-CREATE SITE EXPENSE for the paid amount ──────────────────────────
    // If the user paid any advance to the supplier at the time of receipt,
    // record it automatically as a siteExpense (type = "materialPayment").
    // This ensures the financial summary deducts it from the project advance
    // without the user having to enter it separately.
    if (paidAmount > 0) {
        await _createMaterialExpense(receiptId, receivedData, paidAmount);
    }

    return { receiptId, ...receivedData };
};


exports.getMaterialReceived = async (projectNo) => {
    let query = materialReceivedCollection;
    if (projectNo) query = query.where("projectNo", "==", projectNo);
    const snapshot = await query.get();
    const received = [];
    snapshot.forEach((doc) => received.push({ receiptId: doc.id, ...doc.data() }));
    return received;
};


exports.getMaterialReceivedByMaterialId = async (materialId) => {
    const snapshot = await materialReceivedCollection
        .where("materialId", "==", materialId).get();
    if (snapshot.empty)
        throw new Error(`No received records found for material ID '${materialId}'`);
    return snapshot.docs.map(doc => ({ receiptId: doc.id, ...doc.data() }));
};


exports.updateReceiptPayment = async (receiptId, paymentData) => {
    const docRef = materialReceivedCollection.doc(receiptId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Receipt not found");

    const newPaidAmount = Number(paymentData.paidAmount) || 0;
    const oldData = doc.data();
    const totalAmount = Number(oldData.totalAmount) || 0;

    await docRef.update({
        paidAmount: newPaidAmount,
        dueAmount: totalAmount - newPaidAmount,
    });

    // ── Sync the linked siteExpense ───────────────────────────────────────────
    // If there's already an auto-expense for this receipt → update its amount.
    // If paidAmount is now > 0 and no expense exists yet → create it.
    // If paidAmount is 0 → delete the expense.
    const existingExpSnap = await siteExpensesCollection
        .where("receiptId", "==", receiptId)
        .where("type", "==", "materialPayment")
        .get();

    if (newPaidAmount > 0) {
        if (existingExpSnap.empty) {
            await _createMaterialExpense(receiptId, oldData, newPaidAmount);
        } else {
            await existingExpSnap.docs[0].ref.update({
                amount: newPaidAmount,
                updatedAt: new Date().toISOString(),
            });
        }
    } else {
        // paidAmount set to 0 → remove the expense entry
        const deletes = existingExpSnap.docs.map(d => d.ref.delete());
        await Promise.all(deletes);
    }

    const updatedDoc = await docRef.get();
    return { receiptId: updatedDoc.id, ...updatedDoc.data() };
};


exports.updateMaterialReceived = async (receiptId, updateData) => {
    const docRef = materialReceivedCollection.doc(receiptId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Receipt not found");

    const oldData = doc.data();
    const existingQty = Number(oldData.quantity) || 0;
    const addedQty = Number(updateData.quantity) || 0;  // additional qty being added
    const newQty = existingQty + addedQty;

    const currentRate = updateData.rate !== undefined
        ? Number(updateData.rate)
        : (Number(oldData.rate) || 0);

    const newTotalAmount = newQty * currentRate;
    const newPaidAmount = updateData.paidAmount !== undefined
        ? Number(updateData.paidAmount)
        : (Number(oldData.paidAmount) || 0);

    const updatedRecord = {
        ...updateData,
        quantity: newQty,
        totalAmount: newTotalAmount,
        paidAmount: newPaidAmount,
        dueAmount: newTotalAmount - newPaidAmount,
        updatedAt: new Date().toISOString(),
    };

    // ── Stock update (additive) ───────────────────────────────────────────────
    if (addedQty !== 0) {
        const stockId = `${oldData.projectNo}_${oldData.materialId}`;
        const stockRef = stockCollection.doc(stockId);
        const stockDoc = await stockRef.get();
        if (stockDoc.exists) {
            const s = stockDoc.data();
            await stockRef.update({
                receivedQuantity: (s.receivedQuantity || 0) + addedQty,
                stock: (s.stock || 0) + addedQty,
            });
        }
    }

    await docRef.update(updatedRecord);

    // ── Sync linked siteExpense if paidAmount changed ─────────────────────────
    if (newPaidAmount !== (Number(oldData.paidAmount) || 0)) {
        await _updateMaterialExpense(receiptId, newPaidAmount);
    }

    const updatedDoc = await docRef.get();
    return { receiptId: updatedDoc.id, ...updatedDoc.data() };
};


/**
 * Delete a material receipt AND the auto-generated siteExpense linked to it.
 * Also restores stock.
 */
exports.deleteMaterialReceived = async (receiptId) => {
    const docRef = materialReceivedCollection.doc(receiptId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Receipt not found");

    const data = doc.data();
    const quantity = Number(data.quantity) || 0;
    const stockId = `${data.projectNo}_${data.materialId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    // Restore stock
    if (stockDoc.exists && quantity > 0) {
        const s = stockDoc.data();
        await stockRef.update({
            receivedQuantity: Math.max(0, (s.receivedQuantity || 0) - quantity),
            stock: Math.max(0, (s.stock || 0) - quantity),
        });
    }

    // Remove linked material payment expense
    await _deleteMaterialExpense(receiptId);

    await docRef.delete();
    return { message: "Material receipt deleted and stock/expense restored", receiptId };
};


// ─── Material Used ────────────────────────────────────────────────────────────

exports.recordMaterialUsed = async (usedData) => {
    if (!usedData.projectNo || !usedData.materialId)
        throw new Error("projectNo and materialId are required");

    const qtyUsed = Number(usedData.quantityUsed) || 0;
    if (qtyUsed <= 0) throw new Error("quantityUsed must be a positive number");

    const stockId = `${usedData.projectNo}_${usedData.materialId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    if (!stockDoc.exists) {
        throw new Error(
            `Material '${usedData.materialId}' has not been received for project '${usedData.projectNo}'. Please receive the material first.`
        );
    }

    const currentStock = stockDoc.data();

    if (usedData.materialName &&
        currentStock.materialName.toLowerCase() !== usedData.materialName.toLowerCase()) {
        throw new Error(
            `Material ID '${usedData.materialId}' was received as '${currentStock.materialName}', not '${usedData.materialName}'.`
        );
    }

    // Dedup guard
    const usedDate = usedData.date ||
        (usedData.usedDate
            ? usedData.usedDate.substring(0, 10)
            : new Date().toISOString().split("T")[0]);

    const dupSnap = await materialUsedCollection
        .where("projectNo", "==", usedData.projectNo)
        .where("materialId", "==", usedData.materialId)
        .where("date", "==", usedDate)
        .where("quantityUsed", "==", qtyUsed)
        .get();

    if (!dupSnap.empty) {
        const existing = dupSnap.docs[0];
        return { usageId: existing.id, ...existing.data() };
    }

    const availableStock = Number(currentStock.stock) || 0;
    if (qtyUsed > availableStock) {
        throw new Error(
            `Insufficient stock. Available: ${availableStock}, Requested: ${qtyUsed}. Please receive more material first.`
        );
    }

    usedData.date = usedDate;
    usedData.usedDate = usedData.usedDate || new Date().toISOString();
    usedData.createdAt = new Date().toISOString();
    const docRef = await materialUsedCollection.add(usedData);

    await stockRef.update({
        usedQuantity: (currentStock.usedQuantity || 0) + qtyUsed,
        stock: availableStock - qtyUsed,
    });

    return { usageId: docRef.id, ...usedData };
};


exports.updateMaterialUsed = async (usageId, updateData) => {
    const docRef = materialUsedCollection.doc(usageId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Material used record not found");

    const oldData = doc.data();
    const oldQty = Number(oldData.quantityUsed) || 0;
    const newQty = Number(updateData.quantityUsed);

    if (!isNaN(newQty) && newQty !== oldQty) {
        const stockId = `${oldData.projectNo}_${oldData.materialId}`;
        const stockRef = stockCollection.doc(stockId);
        const stockDoc = await stockRef.get();

        if (stockDoc.exists) {
            const s = stockDoc.data();
            const diff = newQty - oldQty;          // +ve = more used, -ve = returned
            const newAvailable = (Number(s.stock) || 0) - diff;

            if (newAvailable < 0) {
                throw new Error(
                    `Insufficient stock. Available: ${s.stock}, Extra needed: ${diff}`
                );
            }

            await stockRef.update({
                usedQuantity: (Number(s.usedQuantity) || 0) + diff,
                stock: newAvailable,
            });
        }
    }

    await docRef.update({ ...updateData, updatedAt: new Date().toISOString() });
    const updatedDoc = await docRef.get();
    return { usageId: updatedDoc.id, ...updatedDoc.data() };
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
    if (!data.projectNo || !data.materialId)
        throw new Error("projectNo and materialId are required");
    if (!data.materialName)
        throw new Error("materialName is required");

    const qty = Number(data.requiredQuantity) || 0;
    if (qty <= 0) throw new Error("requiredQuantity must be a positive number");

    // Upsert: one record per projectNo + materialId
    const existingSnap = await materialRequiredCollection
        .where("projectNo", "==", data.projectNo)
        .where("materialId", "==", data.materialId)
        .get();

    let requiredDocId;
    let newRequiredQuantity;

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