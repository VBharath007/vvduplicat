const { db } = require("../../config/firebase");

const materialsCollection = db.collection("materials");
const materialReceivedCollection = db.collection("materialReceived");
const materialUsedCollection = db.collection("materialUsed");
const stockCollection = db.collection("stock");
const materialRequiredCollection = db.collection("materialRequired");
const materialPlanCollection = db.collection("materialPlan");
const siteExpensesCollection = db.collection("siteExpenses");
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
                // ✅ FIX 4: doc ID = materialId → consistent lookup everywhere
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

async function _createMaterialExpense(receiptId, receivedData, paidAmount) {
    // ✅ FIX 3: always store ISO date → Flutter formatDate() works correctly
    const isoNow = new Date().toISOString();

    const expenseData = {
        projectNo: receivedData.projectNo,
        amount: paidAmount,
        particular: `Material Purchase: ${receivedData.materialName}`,
        remark: `Material Purchase: ${receivedData.materialName}`,
        type: "materialPayment",
        materialId: receivedData.materialId,
        receiptId,
        date: isoNow,
        createdAt: isoNow,
    };

    const snap = await siteExpensesCollection
        .where("projectNo", "==", receivedData.projectNo).get();
    let totalPrevious = 0;
    snap.forEach(doc => { totalPrevious += Number(doc.data().amount) || 0; });
    expenseData.pastExpense = totalPrevious;

    await siteExpensesCollection.add(expenseData);
}

async function _updateMaterialExpense(receiptId, newPaidAmount) {
    const snap = await siteExpensesCollection
        .where("receiptId", "==", receiptId)
        .where("type", "==", "materialPayment")
        .get();
    if (snap.empty) return;
    const expenseRef = snap.docs[0].ref;
    if (newPaidAmount <= 0) {
        await expenseRef.delete();
    } else {
        await expenseRef.update({ amount: newPaidAmount, updatedAt: new Date().toISOString() });
    }
}

async function _deleteMaterialExpense(receiptId) {
    const snap = await siteExpensesCollection
        .where("receiptId", "==", receiptId)
        .where("type", "==", "materialPayment")
        .get();
    await Promise.all(snap.docs.map(doc => doc.ref.delete()));
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

exports.recordMaterialReceived = async (receivedData) => {
    const normalizedId = receivedData.materialId ? receivedData.materialId.trim().toUpperCase() : null;
    const normalizedName = receivedData.materialName ? receivedData.materialName.trim().toUpperCase() : null;

    if (!receivedData.projectNo || !normalizedId) throw new Error("projectNo and materialId are required");
    if (!normalizedName) throw new Error("materialName is required");

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
        createdAt: new Date().toISOString()
    };

    const docRef = await materialReceivedCollection.add(finalData);
    const receiptId = docRef.id;

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

    if (paidAmount > 0) {
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

exports.updateReceiptPayment = async (receiptId, paymentData) => {
    const docRef = materialReceivedCollection.doc(receiptId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Receipt not found");

    const newPaidAmount = Number(paymentData.paidAmount) || 0;
    const oldData = doc.data();
    const totalAmount = Number(oldData.totalAmount) || 0;

    await docRef.update({
        paidAmount: newPaidAmount,
        dueAmount: Math.max(0, totalAmount - newPaidAmount),
    });

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
        await Promise.all(existingExpSnap.docs.map(d => d.ref.delete()));
    }

    const updatedDoc = await docRef.get();
    return { receiptId: updatedDoc.id, ...updatedDoc.data() };
};

exports.updateMaterialReceived = async (receiptId, updateData) => {
    const docRef = materialReceivedCollection.doc(receiptId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Receipt not found");

    const oldData = doc.data();

    // PUT = SET, not ADD
    const oldQty = Number(oldData.quantity) || 0;
    const newQty = updateData.quantity !== undefined ? Number(updateData.quantity) : oldQty;

    const newRate = updateData.rate !== undefined
        ? Number(updateData.rate)
        : (Number(oldData.rate) || 0);

    const newTotalAmount = newQty * newRate;
    const newPaidAmount = updateData.paidAmount !== undefined
        ? Number(updateData.paidAmount)
        : (Number(oldData.paidAmount) || 0);

    const updatedRecord = {
        ...updateData,
        quantity: newQty,
        rate: newRate,
        totalAmount: newTotalAmount,
        paidAmount: newPaidAmount,
        dueAmount: Math.max(0, newTotalAmount - newPaidAmount),
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

    // Strip undefined before Firestore update
    const cleanRecord = Object.fromEntries(
        Object.entries(updatedRecord).filter(([_, v]) => v !== undefined)
    );
    await docRef.update(cleanRecord);

    if (newPaidAmount !== (Number(oldData.paidAmount) || 0)) {
        await _updateMaterialExpense(receiptId, newPaidAmount);
    }

    const updatedDoc = await docRef.get();
    return { receiptId: updatedDoc.id, ...updatedDoc.data() };
};

exports.deleteMaterialReceived = async (receiptId) => {
    const docRef = materialReceivedCollection.doc(receiptId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Receipt not found");

    const data = doc.data();
    const quantity = Number(data.quantity) || 0;
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

    await _deleteMaterialExpense(receiptId);
    await docRef.delete();
    return { message: "Material receipt deleted and stock/expense restored", receiptId };
};

// ─── Material Used ────────────────────────────────────────────────────────────

// ✅ FIX 1+2: Only ONE definition, receiptDate replaced with usedDate
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

    // ✅ usedDate defined locally — no dependency on outer scope
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