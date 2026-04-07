const { db } = require("../../config/firebase");

const banksCollection = db.collection("banks");

// ─────────────────────────────────────────────
// 📊 GET ALL BANKS + TOTALS
// ─────────────────────────────────────────────
exports.getAllBanksWithSummary = async () => {
  const snapshot = await banksCollection.get();

  let banks = [];
  let totalOpening = 0;
  let totalCurrent = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();

    const opening = Number(data.openingBalance || 0);
    const current = Number(data.currentBalance || 0);

    totalOpening += opening;
    totalCurrent += current;

    banks.push({
      id: doc.id,
      ...data,
    });
  });

  return {
    banks,
    summary: {
      totalOpeningBalance: totalOpening,
      totalClosingBalance: totalCurrent,
    },
  };
};

// ─────────────────────────────────────────────
// 🏦 GET SINGLE BANK
// ─────────────────────────────────────────────
exports.getBankById = async (bankId) => {
  const doc = await banksCollection.doc(bankId).get();
  if (!doc.exists) throw new Error("Bank not found");

  return { id: doc.id, ...doc.data() };
};

// ─────────────────────────────────────────────
// 📜 GET BANK TRANSACTIONS
// ─────────────────────────────────────────────
exports.getBankTransactions = async (bankId) => {
  const snapshot = await banksCollection
    .doc(bankId)
    .collection("transactions")
    .orderBy("createdAt", "desc")
    .get();

  let transactions = [];

  snapshot.forEach((doc) => {
    transactions.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  return transactions;
};

// ─────────────────────────────────────────────
// ➕ CREATE BANK
// ─────────────────────────────────────────────
exports.createBank = async (data) => {
  const {
    bankName,
    accountNumber,
    openingBalance = 0,
  } = data;

  if (!bankName || !accountNumber) {
    throw new Error("Bank name and account number are required");
  }

  const newBankRef = await banksCollection.add({
    bankName,
    accountNumber,
    openingBalance: Number(openingBalance),
    currentBalance: Number(openingBalance),
    closingBalance: Number(openingBalance),
    createdAt: new Date().toISOString(),
  });

  const newDoc = await newBankRef.get();

  return {
    id: newDoc.id,
    ...newDoc.data(),
  };
};  