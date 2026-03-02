const { db } = require("../../config/firebase");
const { v4: uuidv4 } = require("uuid");

const MATERIALS = "materials";
const nowIST = () => new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

/**
 * Generate credit schedule
 */
function generateCreditSchedule(creditDays, intervalPercent) {
    const intervalDays = Math.ceil(creditDays * intervalPercent / 100);
    const schedule = [];
    let day = intervalDays;
    while (day < creditDays) {
        schedule.push({ reminderDay: day });
        day += intervalDays;
    }
    schedule.push({ reminderDay: creditDays });
    return schedule;
}

/**
 * Compute paymentStatus from dealerLedger
 */
function computePaymentStatus(dealerLedger) {
    if (!dealerLedger || dealerLedger.length === 0) return "Unpaid";
    const totalRemaining = dealerLedger.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
    const totalPaid = dealerLedger.reduce((sum, d) => sum + (d.amountPaid || 0), 0);
    if (totalRemaining === 0) return "Paid";
    if (totalPaid === 0) return "Unpaid";
    return "Partial";
}

/**
 * Recalculate material-level totals from dealerLedger
 */
function recalcMaterialTotals(dealerLedger) {
    const overallAmount = Math.round(dealerLedger.reduce((sum, d) => sum + (d.totalAmount || 0), 0));
    const remainingAmount = Math.round(dealerLedger.reduce((sum, d) => sum + (d.remainingAmount || 0), 0));
    const paymentStatus = computePaymentStatus(dealerLedger);
    return { overallAmount, remainingAmount, paymentStatus };
}

/* ─── CRUD ──────────────────────────────────────────────────────────────── */

exports.createMaterial = async (data) => {
    const { name, unit } = data;
    const now = nowIST();
    const docRef = db.collection(MATERIALS).doc();
    const materialData = {
        id: docRef.id, name, unit,
        totalQuantity: 0, currentQuantity: 0, totalUsed: 0,
        overallAmount: 0, remainingAmount: 0,
        paymentStatus: "Unpaid",
        dealerLedger: [], paymentHistory: [],
        createdAt: now, updatedAt: now
    };
    await docRef.set(materialData);
    return materialData;
};

exports.getAllMaterials = async () => {
    const snap = await db.collection(MATERIALS).get();
    return snap.docs.map(d => d.data());
};

exports.getMaterialById = async (id) => {
    const doc = await db.collection(MATERIALS).doc(id).get();
    if (!doc.exists) throw new Error("Material not found");
    return doc.data();
};

exports.updateMaterial = async (id, body) => {
    const docRef = db.collection(MATERIALS).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Material not found");
    const now = nowIST();
    const updatedData = { ...body, updatedAt: now };
    await docRef.update(updatedData);
    return { ...doc.data(), ...updatedData };
};

exports.deleteMaterial = async (id) => {
    const docRef = db.collection(MATERIALS).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Material not found");
    await docRef.delete();
};

/* ─── DEALER PURCHASE ──────────────────────────────────────────────────── */

exports.dealerPurchase = async (id, body) => {
    const { dealerName, quantity, amountPerUnit, date, remark, creditDays, intervalPercent } = body;
    const docRef = db.collection(MATERIALS).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Material not found");

    const material = doc.data();
    const now = nowIST();
    const totalAmount = Math.round(quantity * amountPerUnit);

    const dealerLedger = material.dealerLedger || [];
    let dealer = dealerLedger.find(d => d.dealerName === dealerName);

    if (!dealer) {
        // New dealer must provide credit info
        if (!creditDays || !intervalPercent) {
            const err = new Error("creditDays and intervalPercent are required for a new dealer");
            err.statusCode = 400;
            throw err;
        }
        dealer = {
            dealerId: uuidv4(),
            dealerName,
            creditDays: Number(creditDays),
            intervalPercent: Number(intervalPercent),
            totalPurchased: 0,
            totalAmount: 0,
            amountPaid: 0,
            remainingAmount: 0,
            transactions: [],
            paymentHistory: [],
            creditSchedule: generateCreditSchedule(Number(creditDays), Number(intervalPercent)),
            paymentStatus: "Unpaid"
        };
        dealerLedger.push(dealer);
    }

    const previousTotal = dealer.totalPurchased || 0;
    const runningTotal = previousTotal + quantity;

    dealer.transactions = dealer.transactions || [];
    dealer.transactions.push({
        date, quantityPurchased: quantity,
        amountPerUnit, totalAmount,
        previousTotal, runningTotal,
        remark: remark || ""
    });

    dealer.totalPurchased = Math.round(runningTotal);
    dealer.totalAmount = Math.round((dealer.totalAmount || 0) + totalAmount);
    dealer.remainingAmount = Math.round((dealer.remainingAmount || 0) + totalAmount);

    const newTotalQuantity = Math.round((material.totalQuantity || 0) + quantity);
    const newCurrentQuantity = Math.round((material.currentQuantity || 0) + quantity);
    const { overallAmount, remainingAmount, paymentStatus } = recalcMaterialTotals(dealerLedger);

    await docRef.update({
        dealerLedger,
        totalQuantity: newTotalQuantity,
        currentQuantity: newCurrentQuantity,
        overallAmount,
        remainingAmount,
        paymentStatus,
        updatedAt: now
    });

    return (await docRef.get()).data();
};

/* ─── DEALER PAYMENT (by dealerId) ─────────────────────────────────────── */

exports.dealerPayment = async (materialId, dealerId, body) => {
    const { amountPaid, remark } = body;
    const docRef = db.collection(MATERIALS).doc(materialId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Material not found");

    const material = doc.data();
    const now = nowIST();

    const dealerLedger = material.dealerLedger || [];
    const dealer = dealerLedger.find(d => d.dealerId === dealerId);
    if (!dealer) {
        const err = new Error(`Dealer with ID '${dealerId}' not found`);
        err.statusCode = 404;
        throw err;
    }

    if (amountPaid > dealer.remainingAmount) {
        const err = new Error(`Payment (${amountPaid}) exceeds dealer remaining amount (${dealer.remainingAmount})`);
        err.statusCode = 400;
        throw err;
    }

    dealer.amountPaid = Math.round((dealer.amountPaid || 0) + amountPaid);
    dealer.remainingAmount = Math.round(dealer.remainingAmount - amountPaid);
    dealer.paymentStatus = dealer.remainingAmount === 0 ? "Paid"
        : dealer.amountPaid === 0 ? "Unpaid" : "Partial";

    dealer.paymentHistory = dealer.paymentHistory || [];
    dealer.paymentHistory.push({
        type: "Payment",
        amountPaid,
        remainingAmount: dealer.remainingAmount,
        dateTime: now,
        remark: remark || "Payment Updated"
    });

    // Always recalculate material totals from dealer data
    const { overallAmount, remainingAmount, paymentStatus } = recalcMaterialTotals(dealerLedger);

    const globalHistory = material.paymentHistory || [];
    globalHistory.push({
        dealerId, dealerName: dealer.dealerName,
        amountPaid, remainingAmount,
        dateTime: now, remark: remark || "Payment Updated"
    });

    await docRef.update({
        dealerLedger,
        overallAmount,
        remainingAmount,
        paymentStatus,
        paymentHistory: globalHistory,
        updatedAt: now
    });

    return (await docRef.get()).data();
};
