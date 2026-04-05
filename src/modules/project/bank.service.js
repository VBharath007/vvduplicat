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
    bankData.openingBalance = bankData.openingBalance || 0;
    bankData.currentBalance = bankData.currentBalance || bankData.openingBalance || 0;
    bankData.closingBalance = bankData.closingBalance || bankData.currentBalance || 0;
    
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

exports.incrementBankBalance = async (bankId, amount) => {
    const doc = await banksCollection.doc(bankId).get();
    if (!doc.exists) throw new Error("Bank account not found");

    const bankData = doc.data();
    const currentBalance = Number(bankData.currentBalance || 0);
    const closingBalance = Number(bankData.closingBalance || 0);
    
    const newCurrentBalance = currentBalance + Number(amount);
    const newClosingBalance = closingBalance + Number(amount);

    await banksCollection.doc(bankId).update({
        currentBalance: newCurrentBalance,
        closingBalance: newClosingBalance,
        updatedAt: new Date().toISOString()
    });

    const updated = await banksCollection.doc(bankId).get();
    return { id: updated.id, ...updated.data() };
};

exports.decrementBankBalance = async (bankId, amount) => {
    const doc = await banksCollection.doc(bankId).get();
    if (!doc.exists) throw new Error("Bank account not found");

    const bankData = doc.data();
    const currentBalance = Number(bankData.currentBalance || 0);
    const closingBalance = Number(bankData.closingBalance || 0);
    
    const newCurrentBalance = Math.max(0, currentBalance - Number(amount));
    const newClosingBalance = Math.max(0, closingBalance - Number(amount));

    await banksCollection.doc(bankId).update({
        currentBalance: newCurrentBalance,
        closingBalance: newClosingBalance,
        updatedAt: new Date().toISOString()
    });

    const updated = await banksCollection.doc(bankId).get();
    return { id: updated.id, ...updated.data() };
};

/**
 * Create a temporary bank account for an advance payment
 * This is used when user selects "New Bank" option instead of existing bank
 */
exports.createTemporaryBankForAdvance = async (bankDetails) => {
    const { projectNo, accountName, accountNumber, bankName, ifscCode, accountType, amountReceived } = bankDetails;

    if (!accountName || !accountNumber || !bankName) {
        throw new Error("Account name, number, and bank name are required");
    }

    const docRef = banksCollection.doc();
    const newBank = {
        projectNo: projectNo || null,
        accountName: accountName,
        accountNumber: accountNumber,
        bankName: bankName,
        ifscCode: ifscCode || "N/A",
        accountType: accountType || "Savings",
        status: "Active",
        openingBalance: Number(amountReceived) || 0,
        currentBalance: Number(amountReceived) || 0,
        closingBalance: Number(amountReceived) || 0,
        createdAt: new Date().toISOString(),
        createdViaAdvance: true,
        remarks: "Auto-created from advance payment"
    };

    await docRef.set(newBank);
    return { id: docRef.id, ...newBank };
};

exports.addAdvanceWithPaymentMode = async (projectNo, advanceData) => {
    const { amountReceived, paymentMode, bankId, bankDetails, date, remark } = advanceData;

    if (!amountReceived || !paymentMode) {
        throw new Error("Amount and payment mode are required");
    }

    let finalBankId = bankId;
    let bankName = null;

    // If BANK payment mode is selected
    if (paymentMode === "BANK") {
        // Check if user is creating a new bank or using existing
        if (!bankId && bankDetails) {
            // Create a new bank account on-the-fly
            const newBank = await exports.createTemporaryBankForAdvance({
                projectNo: projectNo,
                accountName: bankDetails.accountName,
                accountNumber: bankDetails.accountNumber,
                bankName: bankDetails.bankName,
                ifscCode: bankDetails.ifscCode,
                accountType: bankDetails.accountType,
                amountReceived: amountReceived
            });
            finalBankId = newBank.id;
            bankName = newBank.accountName;
        } else if (bankId) {
            // Use existing bank account
            const bank = await exports.getBankById(bankId);
            bankName = bank.accountName;
            // Increment existing bank balance
            await exports.incrementBankBalance(bankId, amountReceived);
        } else {
            throw new Error("Bank account is required for BANK payment mode");
        }
    }

    const advanceRef = advancesCollection.doc();
    const advanceRecord = {
        projectNo,
        amountReceived: Number(amountReceived),
        paymentMode,
        bankId: finalBankId || null,
        bankName: bankName || null,
        date: date || new Date().toISOString().split("T")[0],
        remark: remark || "Project Advance",
        createdAt: new Date().toISOString(),
        sno: 1,
    };

    await advanceRef.set(advanceRecord);
    return { id: advanceRef.id, ...advanceRecord, createdBankId: finalBankId };
};

module.exports = exports;