const { db } = require("../../config/firebase");

const materialsCollection = db.collection("materials");
const materialReceivedCollection = db.collection("materialReceived");

const materialUsedCollection = db.collection("materialUsed");
const stockCollection = db.collection("stock");
const materialRequiredCollection = db.collection("materialRequired");
const materialPlanCollection = db.collection("materialPlan");
// --- Material Master --- //
exports.createMaterial = async (materialData) => {
    if (!materialData.materialId) {
        throw new Error("materialId is required");
    }
    const docRef = materialsCollection.doc(materialData.materialId);
    const doc = await docRef.get();
    if (doc.exists) {
        throw new Error("Material with this materialId already exists");
    }
    await docRef.set(materialData);
    return materialData;
};

exports.getMaterials = async () => {
    const snapshot = await materialsCollection.get();
    const materials = [];
    snapshot.forEach((doc) => {
        materials.push(doc.data());
    });
    return materials;
};

// --- Material Received --- //
exports.recordMaterialReceived = async (receivedData) => {
    if (!receivedData.projectNo || !receivedData.materialId) {
        throw new Error("projectNo and materialId are required");
    }
    if (!receivedData.materialName) {
        throw new Error("materialName is required");
    }

    // --- Validate: materialId must always refer to the same materialName ---
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

    // Ensure numeric calculations
    const quantity = Number(receivedData.quantity) || 0;
    const rate = Number(receivedData.rate) || 0;
    receivedData.totalAmount = quantity * rate;
    receivedData.paidAmount = Number(receivedData.paidAmount) || 0;

    const docRef = await materialReceivedCollection.add(receivedData);

    // --- Update Stock ---
    const qty = quantity;

    if (stockDoc.exists) {
        const currentStock = stockDoc.data();
        await stockRef.update({
            receivedQuantity: (currentStock.receivedQuantity || 0) + qty,
            stock: (currentStock.stock || 0) + qty
        });
    } else {
        await stockRef.set({
            projectNo: receivedData.projectNo,
            materialId: receivedData.materialId,
            materialName: receivedData.materialName,
            receivedQuantity: qty,
            usedQuantity: 0,
            stock: qty
        });
    }

    return { receiptId: docRef.id, ...receivedData };
};


exports.getMaterialReceived = async (projectNo) => {
    let query = materialReceivedCollection;
    if (projectNo) {
        query = query.where("projectNo", "==", projectNo);
    }
    const snapshot = await query.get();
    const received = [];
    snapshot.forEach((doc) => {
        received.push({ receiptId: doc.id, ...doc.data() });
    });
    return received;
};

exports.getMaterialReceivedByMaterialId = async (materialId) => {
    const snapshot = await materialReceivedCollection
        .where("materialId", "==", materialId)
        .get();
    if (snapshot.empty) {
        throw new Error(`No received records found for material ID '${materialId}'`);
    }
    return snapshot.docs.map(doc => ({ receiptId: doc.id, ...doc.data() }));
};


exports.updateReceiptPayment = async (receiptId, paymentData) => {
    const docRef = materialReceivedCollection.doc(receiptId);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new Error("Receipt not found");
    }

    const currentData = doc.data();
    // Assuming paymentData.paidAmount replaces the existing, or adds to it? 
    // "This updates the payment of that specific material bill." Let's update it to the new value or add? The prompt says: "Body Example: { "paidAmount": 30000 }"
    // It's probably a direct update or accumulate. I'll just update it as per the body request.
    const newPaidAmount = Number(paymentData.paidAmount) || 0;

    await docRef.update({ paidAmount: newPaidAmount });

    const updatedDoc = await docRef.get();
    return { receiptId: updatedDoc.id, ...updatedDoc.data() };
};

// --- Material Used --- //
exports.recordMaterialUsed = async (usedData) => {
    if (!usedData.projectNo || !usedData.materialId) {
        throw new Error("projectNo and materialId are required");
    }

    const qtyUsed = Number(usedData.quantityUsed) || 0;
    if (qtyUsed <= 0) {
        throw new Error("quantityUsed must be a positive number");
    }

    // --- Validate: material must have been purchased/received first ---
    const stockId = `${usedData.projectNo}_${usedData.materialId}`;
    const stockRef = stockCollection.doc(stockId);
    const stockDoc = await stockRef.get();

    if (!stockDoc.exists) {
        throw new Error(
            `Material '${usedData.materialId}' has not been purchased/received for project '${usedData.projectNo}'. Please receive the material first.`
        );
    }

    const currentStock = stockDoc.data();

    // --- Validate: materialName must match the purchased material ---
    if (usedData.materialName &&
        currentStock.materialName.toLowerCase() !== usedData.materialName.toLowerCase()) {
        throw new Error(
            `Material ID '${usedData.materialId}' was purchased as '${currentStock.materialName}', not '${usedData.materialName}'. Please use the correct material name.`
        );
    }

    const availableStock = Number(currentStock.stock) || 0;

    // --- Validate: cannot use more than available stock ---
    if (qtyUsed > availableStock) {
        throw new Error(
            `Insufficient stock. Available: ${availableStock}, Requested: ${qtyUsed}. Please receive more material first.`
        );
    }


    usedData.usedDate = usedData.usedDate || new Date().toISOString();

    const docRef = await materialUsedCollection.add(usedData);

    // --- Update Stock ---
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
    if (!data.projectNo || !data.materialId) {
        throw new Error("projectNo and materialId are required");
    }
    if (!data.materialName) {
        throw new Error("materialName is required");
    }

    // --- Validate: materialId must refer to the correct materialName ---
    if (data.projectNo) {
        const stockId = `${data.projectNo}_${data.materialId}`;
        const stockDoc = await stockCollection.doc(stockId).get();

        if (stockDoc.exists) {
            const existingName = stockDoc.data().materialName;
            if (existingName.toLowerCase() !== data.materialName.toLowerCase()) {
                throw new Error(
                    `Material ID '${data.materialId}' is already registered as '${existingName}'. You can only request '${existingName}' for this material ID.`
                );
            }
        }
    }

    data.createdAt = new Date().toISOString();
    const docRef = await materialRequiredCollection.add(data);
    return { id: docRef.id, ...data };
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
        .where("projectNo", "==", projectNo)
        .get();

    const stockSnap = await stockCollection
        .where("projectNo", "==", projectNo)
        .get();

    const plans = planSnap.docs.map(doc => doc.data());
    const stocks = stockSnap.docs.map(doc => doc.data());

    const result = plans.map(plan => {
        const stockItem = stocks.find(s => s.materialId === plan.materialId);
        const stock = stockItem ? stockItem.stock : 0;

        const plannedQuantity = Number(plan.plannedQuantity) || 0;
        const required = plannedQuantity - stock;

        return {
            materialId: plan.materialId,
            materialName: plan.materialName,
            plannedQuantity: plannedQuantity,
            stock,
            materialRequired: required > 0 ? required : 0
        };
    });

    return result;
};
