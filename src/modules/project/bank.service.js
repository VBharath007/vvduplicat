// src/modules/project/bank.service.js

const { db } = require("../../config/firebase");

const banksCollection = db.collection("banks");
const advancesCollection = db.collection("advances");

exports.createBank = async (bankData) => {
    if (!bankData || !bankData.accountName || !bankData.accountNumber) {
        throw new Error("Account name and number are required");
    }

    const docRef = banksCollection.doc();
    bankData.createdAt = new Date().toISOString();
    bankData.status = bankData.status || "Active";
    
    await docRef.set(bankData);
    return { id: docRef.id, ...bankData };
};

exports.getAllBanks = async () => {
    const snapshot = await banksCollection.where("status", "==", "Active").get();
    const banks = [];
    snapshot.forEach(doc => banks.push({ id: doc.id, ...doc.data() }));
    return banks;
};

exports.getBankById = async (bankId) => {
    const doc = await banksCollection.doc(bankId).get();
    if (!doc.exists) throw new Error("Bank account not found");
    return { id: doc.id, ...doc.data() };
};

exports.updateBank = async (bankId, updateData) => {
    const doc = await banksCollection.doc(bankId).get();
    if (!doc.exists) throw new Error("Bank account not found");

    delete updateData.createdAt;
    await banksCollection.doc(bankId).update(updateData);
    
    const updated = await banksCollection.doc(bankId).get();
    return { id: updated.id, ...updated.data() };
};

exports.addAdvanceWithPaymentMode = async (projectNo, advanceData) => {
    const { amountReceived, paymentMode, bankId, date, remark } = advanceData;

    if (!amountReceived || !paymentMode) {
        throw new Error("Amount and payment mode are required");
    }

    if (paymentMode === "UPI" && !bankId) {
        throw new Error("Bank account is required for UPI payment");
    }

    let bankName = null;
    if (bankId) {
        const bank = await exports.getBankById(bankId);
        bankName = bank.accountName;
    }

    const advanceRef = advancesCollection.doc();
    const advanceRecord = {
        projectNo,
        amountReceived: Number(amountReceived),
        paymentMode,
        bankId: bankId || null,
        bankName: bankName,
        date: date || new Date().toISOString().split("T")[0],
        remark: remark || "Project Advance",
        createdAt: new Date().toISOString(),
        sno: 1,
    };

    await advanceRef.set(advanceRecord);
    return { id: advanceRef.id, ...advanceRecord };
};

module.exports = exports;