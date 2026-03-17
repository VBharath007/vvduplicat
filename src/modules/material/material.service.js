const { db } = require("../../config/firebase");

const materialsCollection = db.collection("materials");
const materialReceivedCollection = db.collection("materialReceived");
const materialUsedCollection = db.collection("materialUsed");
const stockCollection = db.collection("stock");
const materialRequiredCollection = db.collection("materialRequired");
const materialPlanCollection = db.collection("materialPlan");
const siteExpensesCollection = db.collection("siteExpenses"); // ← NEW: needed for auto-expense on material payment
const dayjs = require("dayjs");
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

const getFormattedDate = (date) => {
    return date ? dayjs(date).format("DD-MM-YYYY") : dayjs().format("DD-MM-YYYY");
};


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
                // Generate a simple ID or use a UUID
                const docRef = materialsCollection.doc();
                batch.set(docRef, {
                    materialId: name.replace(/\s+/g, '_').toUpperCase(),
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




// ─── Material Received ────────────────────────────────────────────────────────

exports.recordMaterialReceived = async (receivedData) => {
    // 1. Inputs-ai normalize seidhu UpperCase-aga maatrum logic
    const normalizedId = receivedData.materialId ? receivedData.materialId.trim().toUpperCase() : null;
    const normalizedName = receivedData.materialName ? receivedData.materialName.trim().toUpperCase() : null;

    if (!receivedData.projectNo || !normalizedId)
        throw new Error("projectNo and materialId are required");
    if (!normalizedName)
        throw new Error("materialName is required");

    // 2. Master list-il check seidhu UpperCase-aga sync seiyum logic
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

    // 3. Stock consistency check
    const stockId = `${receivedData.projectNo}_${normalizedId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    if (stockDoc.exists) {
        const existingName = stockDoc.data().materialName;
        if (existingName.toUpperCase() !== normalizedName) {
            throw new Error(`Material ID '${normalizedId}' matches '${existingName}'.`);
        }
    }

    // 4. Data-vai prepare seiyum logic (finalData define seiyappattulladhu)
    const receiptDate = getFormattedDate(receivedData.date) || new Date().toISOString().split("T")[0];
    const quantity = Number(receivedData.quantity) || 0;
    const rate = Number(receivedData.rate) || 0;
    const paidAmount = Number(receivedData.paidAmount) || 0;
    const totalAmount = quantity * rate;

    const finalData = {
        ...receivedData,
        materialId: normalizedId,
        materialName: normalizedName,
        date: receiptDate,
        quantity: quantity,
        rate: rate,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        dueAmount: totalAmount - paidAmount,
        createdAt: new Date().toISOString()
    };

    // 5. Receipt-ai save seiyum logic
    const docRef = await materialReceivedCollection.add(finalData);
    const receiptId = docRef.id;

    // 6. Stock Update (20 + 50 = 70 summation logic)
    if (stockDoc.exists) {
        const currentStockData = stockDoc.data();
        await stockRef.update({
            // Rerkkanave irukkum quantity-udan ippo varuvadhai kootum logic
            receivedQuantity: (Number(currentStockData.receivedQuantity) || 0) + quantity,
            stock: (Number(currentStockData.stock) || 0) + quantity,
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

    // 7. Auto-Expense record
    if (paidAmount > 0) {
        await _createMaterialExpense(receiptId, finalData, paidAmount);
    }

    return { receiptId, ...finalData };
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
    const normalizedId = usedData.materialId ? usedData.materialId.trim().toUpperCase() : null;

    if (!usedData.projectNo || !normalizedId) throw new Error("projectNo and materialId are required");

    const qtyUsed = Number(usedData.quantityUsed) || 0;
    const stockId = `${usedData.projectNo}_${normalizedId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    if (!stockDoc.exists) throw new Error("Material not found in stock. Please receive it first.");

    const currentStock = stockDoc.data();
    const availableStock = Number(currentStock.stock) || 0;

    // Custom Error Check
    if (qtyUsed > availableStock) {
        throw new Error(
            `Stock is ${availableStock}, you cannot use ${qtyUsed}. ` +
            `If you want to use this amount, please add material received first and then use it.`
        );
    }

    const finalUsedData = {
        ...usedData,
        materialId: normalizedId,
        materialName: currentStock.materialName,
        quantityUsed: qtyUsed,
        createdAt: receiptDate
    };

    const docRef = await materialUsedCollection.add(finalUsedData);

    await stockRef.update({
        usedQuantity: (Number(currentStock.usedQuantity) || 0) + qtyUsed,
        stock: availableStock - qtyUsed,
        updatedAt: receiptDate
    });

    return { usageId: docRef.id, ...finalUsedData };
};


exports.recordMaterialUsed = async (usedData) => {
    // 1. Input-ai UpperCase-aga maatri duplicate-ai thadukkum logic
    const normalizedId = usedData.materialId ? usedData.materialId.trim().toUpperCase() : null;

    if (!usedData.projectNo || !normalizedId) throw new Error("projectNo and materialId are required");

    const qtyUsed = Number(usedData.quantityUsed) || 0;

    // 2. Database-il irundhu existing stock-ai edukiraen
    const stockId = `${usedData.projectNo}_${normalizedId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    if (!stockDoc.exists) {
        throw new Error(`Material '${normalizedId}' not found in stock. Please receive it first.`);
    }

    const currentStock = stockDoc.data();
    const availableStock = Number(currentStock.stock) || 0;

    // 3. Minus value varamal thadukka Strict Check
    if (qtyUsed > availableStock) {
        throw new Error(
            `Stock is ${availableStock}, you cannot use ${qtyUsed}. ` +
            `If you want to use this amount, please add material received first and then use it.`
        );
    }

    // 4. Data-vai prepare seidhu save seiyum logic
    const finalUsedData = {
        ...usedData,
        materialId: normalizedId,
        materialName: currentStock.materialName, // Master name-aiye payanpaduthugiraen
        quantityUsed: qtyUsed,
        createdAt: receiptDate
    };

    const docRef = await materialUsedCollection.add(finalUsedData);

    // 5. Stock-il irundhu minus seidhu update seiyum logic
    await stockRef.update({
        usedQuantity: (Number(currentStock.usedQuantity) || 0) + qtyUsed,
        stock: availableStock - qtyUsed,
        updatedAt: receiptDate
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


exports.getMaterials = async () => {
    // Fetch and sort by materialName in ascending order
    const snapshot = await materialsCollection.orderBy("materialName", "asc").get();
    const materials = [];
    snapshot.forEach((doc) => {
        materials.push({ id: doc.id, ...doc.data() });
    });
    return materials;
};