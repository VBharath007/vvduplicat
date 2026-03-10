const { db } = require("../../config/firebase");

const materialsCollection = db.collection("materials");
const materialReceivedCollection = db.collection("materialReceived");
const materialUsedCollection = db.collection("materialUsed");

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
    receivedData.createdAt = new Date().toISOString();

    // Ensure numeric calculations
    const quantity = Number(receivedData.quantity) || 0;
    const rate = Number(receivedData.rate) || 0;
    receivedData.totalAmount = quantity * rate;
    receivedData.paidAmount = Number(receivedData.paidAmount) || 0;

    const docRef = await materialReceivedCollection.add(receivedData);
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
    usedData.usedDate = usedData.usedDate || new Date().toISOString();

    const docRef = await materialUsedCollection.add(usedData);
    return { usageId: docRef.id, ...usedData };
};

// --- Material Stock --- //
exports.getMaterialStock = async (projectNo) => {
    if (!projectNo) {
        throw new Error("projectNo is required to calculate stock");
    }

    const receivedSnap = await materialReceivedCollection.where("projectNo", "==", projectNo).get();
    const usedSnap = await materialUsedCollection.where("projectNo", "==", projectNo).get();

    const stockMap = {};

    receivedSnap.forEach(doc => {
        const data = doc.data();
        if (!stockMap[data.materialId]) {
            stockMap[data.materialId] = { materialName: data.materialName, receivedQuantity: 0, usedQuantity: 0 };
        }
        stockMap[data.materialId].receivedQuantity += Number(data.quantity) || 0;
    });

    usedSnap.forEach(doc => {
        const data = doc.data();
        if (!stockMap[data.materialId]) {
            stockMap[data.materialId] = { materialName: data.materialName, receivedQuantity: 0, usedQuantity: 0 };
        }
        stockMap[data.materialId].usedQuantity += Number(data.quantityUsed) || 0;
    });

    return Object.values(stockMap).map(m => ({
        materialName: m.materialName,
        receivedQuantity: m.receivedQuantity,
        usedQuantity: m.usedQuantity,
        stock: m.receivedQuantity - m.usedQuantity
    }));
};

// --- Material Required --- //
exports.addMaterialRequired = async (data) => {
    data.createdAt = new Date().toISOString();
    const docRef = await db.collection("materialRequired").add(data);
    return { id: docRef.id, ...data };
};

exports.updateMaterialRequired = async (id, data) => {
    await db.collection("materialRequired").doc(id).update(data);
    return { id, ...data };
};

exports.getMaterialRequired = async (projectNo) => {
    const planSnap = await db.collection("materialPlan")
        .where("projectNo", "==", projectNo)
        .get();

    const receivedSnap = await materialReceivedCollection
        .where("projectNo", "==", projectNo)
        .get();

    const usedSnap = await materialUsedCollection
        .where("projectNo", "==", projectNo)
        .get();

    const plans = planSnap.docs.map(doc => doc.data());
    const received = receivedSnap.docs.map(doc => doc.data());
    const used = usedSnap.docs.map(doc => doc.data());

    const result = plans.map(plan => {
        const totalReceived = received
            .filter(r => r.materialId === plan.materialId)
            .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

        const totalUsed = used
            .filter(u => u.materialId === plan.materialId)
            .reduce((sum, u) => sum + (Number(u.quantityUsed) || 0), 0);

        const stock = totalReceived - totalUsed;
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
