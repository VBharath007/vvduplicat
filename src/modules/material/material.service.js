const { db } = require("../../config/firebase");

const materialsCollection = db.collection("materials");
const materialReceivedCollection = db.collection("materialReceived");
const materialUsedCollection = db.collection("materialUsed");
const stockCollection = db.collection("stock");
const materialRequiredCollection = db.collection("materialRequired");
const materialPlanCollection = db.collection("materialPlan");

// --- Material Master --- //
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

// --- Material Received --- //
exports.recordMaterialReceived = async (receivedData) => {
    if (!receivedData.projectNo || !receivedData.materialId)
        throw new Error("projectNo and materialId are required");
    if (!receivedData.materialName)
        throw new Error("materialName is required");

    const stockId = `${receivedData.projectNo}_${receivedData.materialId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    if (stockDoc.exists) {
        const existingMaterialName = stockDoc.data().materialName;
        if (existingMaterialName.toLowerCase() !== receivedData.materialName.toLowerCase()) {
            throw new Error(
                `You already purchased material ID '${receivedData.materialId}' with name '${existingMaterialName}'. To purchase '${receivedData.materialName}', please use a different material ID (e.g., MAT002).`
            );
        }
    }

    receivedData.createdAt = new Date().toISOString();
    const quantity = Number(receivedData.quantity) || 0;
    const rate = Number(receivedData.rate) || 0;
    receivedData.totalAmount = quantity * rate;
    receivedData.paidAmount = Number(receivedData.paidAmount) || 0;

    const docRef = await materialReceivedCollection.add(receivedData);

    if (stockDoc.exists) {
        const currentStock = stockDoc.data();
        await stockRef.update({
            receivedQuantity: (currentStock.receivedQuantity || 0) + quantity,
            stock: (currentStock.stock || 0) + quantity
        });
    } else {
        await stockRef.set({
            projectNo: receivedData.projectNo,
            materialId: receivedData.materialId,
            materialName: receivedData.materialName,
            receivedQuantity: quantity,
            usedQuantity: 0,
            stock: quantity
        });
    }

    return { receiptId: docRef.id, ...receivedData };
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
    await docRef.update({ paidAmount: newPaidAmount });
    const updatedDoc = await docRef.get();
    return { receiptId: updatedDoc.id, ...updatedDoc.data() };
};

// --- Material Used --- //
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
            `Material '${usedData.materialId}' has not been purchased/received for project '${usedData.projectNo}'. Please receive the material first.`
        );
    }

    const currentStock = stockDoc.data();

    if (usedData.materialName &&
        currentStock.materialName.toLowerCase() !== usedData.materialName.toLowerCase()) {
        throw new Error(
            `Material ID '${usedData.materialId}' was purchased as '${currentStock.materialName}', not '${usedData.materialName}'. Please use the correct material name.`
        );
    }

    const availableStock = Number(currentStock.stock) || 0;
    if (qtyUsed > availableStock) {
        throw new Error(
            `Insufficient stock. Available: ${availableStock}, Requested: ${qtyUsed}. Please receive more material first.`
        );
    }

    usedData.usedDate = usedData.usedDate || new Date().toISOString();
    const docRef = await materialUsedCollection.add(usedData);

    await stockRef.update({
        usedQuantity: (currentStock.usedQuantity || 0) + qtyUsed,
        stock: availableStock - qtyUsed
    });

    return { usageId: docRef.id, ...usedData };
};

// --- Material Stock --- //
exports.getMaterialStock = async (projectNo) => {
    let snap;
    if (projectNo) {
        snap = await stockCollection.where("projectNo", "==", projectNo).get();
    } else {
        snap = await stockCollection.get();
    }
    return snap.docs.map(doc => doc.data());
};

// --- Material Required --- //
exports.addMaterialRequired = async (data) => {
    if (!data.projectNo || !data.materialId)
        throw new Error("projectNo and materialId are required");
    if (!data.materialName)
        throw new Error("materialName is required");

    const qty = Number(data.requiredQuantity) || 0;
    if (qty <= 0) throw new Error("requiredQuantity must be a positive number");

    // BUG FIX: Removed the block that was updating the stock collection.
    // materialRequired = "what we NEED to buy in future".
    // It should NEVER touch the stock collection.
    // Stock is only updated by: recordMaterialReceived and recordMaterialUsed.
    // The old code was adding requiredQuantity to stock every time the user
    // added a required material entry → stock inflated incorrectly (240kg, 280kg shown).

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
            updatedAt: new Date().toISOString()
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
        requiredQuantity: newRequiredQuantity
    };
};

exports.updateMaterialRequired = async (id, data) => {
    await materialRequiredCollection.doc(id).update(data);
    return { id, ...data };
};

exports.getAllMaterialRequired = async () => {
    const snap = await materialRequiredCollection.get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

exports.getMaterialRequired = async (projectNo) => {
    const planSnap = await materialPlanCollection
        .where("projectNo", "==", projectNo).get();
    const stockSnap = await stockCollection
        .where("projectNo", "==", projectNo).get();

    const plans = planSnap.docs.map(doc => doc.data());
    const stocks = stockSnap.docs.map(doc => doc.data());

    return plans.map(plan => {
        const stockItem = stocks.find(s => s.materialId === plan.materialId);
        const stock = stockItem ? stockItem.stock : 0;
        const plannedQuantity = Number(plan.plannedQuantity) || 0;
        const required = plannedQuantity - stock;
        return {
            materialId: plan.materialId,
            materialName: plan.materialName,
            plannedQuantity,
            stock,
            materialRequired: required > 0 ? required : 0
        };
    });
};