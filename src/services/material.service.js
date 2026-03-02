const { db } = require("../config/firebase");
const MATERIALS = "materials";
const LEDGER = "material_ledger";

/* ===============================
   Create Material
================================ */
exports.createMaterial = async (data) => {
    const docRef = db.collection(MATERIALS).doc(data.id);

    const exists = await docRef.get();
    if (exists.exists) {
        throw new Error("Material ID already exists");
    }

    // Ensure base structure
    data.history = data.history || [];
    data.dealerLedger = [];   // 🔥 Added dealer ledger support
    data.totalQuantity = data.totalQuantity || 0;
    data.currentQuantity = data.currentQuantity || 0;
    data.totalAmount = data.totalQuantity * data.cost;        // 🔹 Auto calculate
    data.remainingAmount = data.totalAmount - (data.paidAmount || 0);
    data.createdAt = new Date().toLocaleString();
    data.updatedAt = new Date().toLocaleString();

    await docRef.set(data);
    return data;
};


/* ===============================
   Get All Materials
================================ */
exports.getAllMaterials = async () => {
    const snapshot = await db.collection(MATERIALS).get();
    return snapshot.docs.map(doc => doc.data());
};


/* ===============================
   Get Material By ID
================================ */
exports.getMaterialById = async (id) => {
    const doc = await db.collection(MATERIALS).doc(id).get();

    if (!doc.exists) throw new Error("Material not found");

    return doc.data();
};


/* ===============================
   Update Material (Safe Conditional)
================================ */
exports.updateMaterial = async (id, updates) => {
    const docRef = db.collection(MATERIALS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Material not found");

    const existing = doc.data();

    if (updates.currentQuantity && updates.currentQuantity < 0) {
        throw new Error("Current quantity cannot be negative");
    }

    const updatedData = {
        ...existing,
        ...updates,
        updatedAt: new Date().toLocaleString()
    };

    await docRef.update(updatedData);

    return updatedData;
};


/* ===============================
   Payment Update + History Append
================================ */
exports.updatePayment = async (id, paymentAmount) => {

    const docRef = db.collection(MATERIALS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Material not found");

    const material = doc.data();

    const newRemaining = material.remainingAmount - paymentAmount;

    if (newRemaining < 0)
        throw new Error("Payment exceeds remaining amount");

    const newHistory = {
        type: "Payment",
        amountPaid: paymentAmount,
        remainingAmount: newRemaining,
        dateTime: new Date().toLocaleString(),
        remark: "Payment Updated"
    };

    const updatedData = {
        ...material,
        paidAmount: material.paidAmount + paymentAmount,
        remainingAmount: newRemaining,
        paymentStatus:
            newRemaining === 0 ? "Paid" : "Partially Paid",
        history: [...material.history, newHistory],
        updatedAt: new Date().toLocaleString()
    };

    await docRef.update(updatedData);

    return updatedData;
};


/* ==================================================
   Dealer Transaction Add (Running Total System)
================================================== */
exports.addDealerTransaction = async (
    materialId,
    dealerName,
    quantity,
    date,
    remark
) => {

    const docRef = db.collection(MATERIALS).doc(materialId);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Material not found");

    const material = doc.data();

    material.dealerLedger = material.dealerLedger || [];

    let dealerIndex = material.dealerLedger.findIndex(
        d => d.dealerName === dealerName
    );

    if (dealerIndex === -1) {
        // New Dealer
        material.dealerLedger.push({
            dealerName,
            transactions: [],
            totalPurchased: 0
        });

        dealerIndex = material.dealerLedger.length - 1;
    }

    const dealer = material.dealerLedger[dealerIndex];

    const previousTotal = dealer.totalPurchased;
    const runningTotal = previousTotal + quantity;

    const newTransaction = {
        date,
        quantityPurchased: quantity,
        previousTotal,
        runningTotal,
        remark
    };

    dealer.transactions.push(newTransaction);
    dealer.totalPurchased = runningTotal;

    // Also increase overall stock
    material.totalQuantity += quantity;
    material.currentQuantity += quantity;

    material.updatedAt = new Date().toLocaleString();

    await docRef.update(material);

    return newTransaction;
};


/* ==================================================
   Get Full Dealer Ledger for Material
================================================== */
exports.getMaterialLedger = async (materialId) => {

    const doc = await db.collection(MATERIALS).doc(materialId).get();

    if (!doc.exists) throw new Error("Material not found");

    return doc.data().dealerLedger || [];
};


/* ==================================================
   Get Specific Dealer Ledger
================================================== */
exports.getDealerLedger = async (materialId, dealerName) => {

    const doc = await db.collection(MATERIALS).doc(materialId).get();

    if (!doc.exists) throw new Error("Material not found");

    const ledger = doc.data().dealerLedger || [];

    const dealer = ledger.find(d => d.dealerName === dealerName);

    if (!dealer) throw new Error("Dealer not found");

    return dealer;
};


/* ===============================
   Delete Material
================================ */
exports.deleteMaterial = async (id) => {
    const docRef = db.collection(MATERIALS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Material not found");

    await docRef.delete();
};

/* ===============================
   Consume Material
================================ */
exports.consumeMaterial = async (materialId, data) => {
    const { quantity, usedBy, siteName } = data;

    const materialRef = db.collection(MATERIALS).doc(materialId);
    const materialDoc = await materialRef.get();

    if (!materialDoc.exists) {
        throw new Error("Material not found");
    }

    const materialData = materialDoc.data();
    const currentStock = materialData.currentQuantity || 0;

    if (quantity > currentStock) {
        throw new Error("Insufficient stock");
    }

    const newStock = currentStock - quantity;

    // 1️⃣ Update stock in main material document
    await materialRef.update({
        currentQuantity: newStock,
        totalUsed: (materialData.totalUsed || 0) + quantity,
        updatedAt: new Date().toLocaleString()
    });

    // 2️⃣ Add entry in separate ledger collection for audit
    await db.collection(LEDGER).add({
        materialId,
        type: "CONSUME",
        quantity,
        usedBy,
        siteName,
        dateTime: new Date().toLocaleString(),
        remark: "Material Consumed",
        createdAt: new Date().toLocaleString()
    });

    return {
        message: "Material consumed successfully",
        remainingStock: newStock
    };
};
