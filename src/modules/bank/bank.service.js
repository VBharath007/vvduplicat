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



exports.getGlobalTransactions = async () => {
    const snapshot = await banksCollection.get();

    let allTransactions = [];
    let totalCurrentBalance = 0;

    // ── 1. Fetch all banks + their transactions ──────────────────────────────
    for (const doc of snapshot.docs) {
        const bankData = doc.data();
        const bankId = doc.id;

        // Sum of all banks' current balance = combined total
        totalCurrentBalance += Number(bankData.currentBalance || 0);

        const txSnapshot = await banksCollection
            .doc(bankId)
            .collection("transactions")
            .get();

        txSnapshot.forEach((txDoc) => {
            const tx = txDoc.data();
            allTransactions.push({
                bankName: bankData.bankName,
                type: tx.type,
                amount: Number(tx.amount || 0),
                remark: tx.remark || "",
                date: tx.date || tx.createdAt,
                createdAt: tx.createdAt,
            });
        });
    }

    // ── 2. Sort NEWEST → OLDEST ──────────────────────────────────────────────
    allTransactions.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // ── 3. Walk backwards from COMBINED total balance ────────────────────────
    // Top row = current combined balance across all banks
    // Each older row = balance BEFORE the newer transaction was applied
    let runningBalance = totalCurrentBalance;

    const finalList = allTransactions.map((tx) => {
        let credit = 0;
        let debit = 0;
        const balanceAtThisRow = runningBalance; // show combined balance AFTER this tx

        if (tx.type === "CREDIT") {
            credit = tx.amount;
            runningBalance -= tx.amount; // reverse for next (older) row
        } else {
            debit = tx.amount;
            runningBalance += tx.amount; // reverse for next (older) row
        }

        return {
            date: tx.date,
            bankName: tx.bankName,
            remark: tx.remark,
            credit,
            debit,
            balance: balanceAtThisRow, // combined balance across ALL banks
            createdAt: tx.createdAt,
        };
    });

    return finalList;
};