const db = require("../../config/firebase").db;
const admin = require("firebase-admin");

// ─────────────────────────────────────────────────────────────────────────
// MATERIAL MASTER
// ─────────────────────────────────────────────────────────────────────────

async function createMaterial(data) {
  const { materialId, materialName, materialUnit, materialType } = data;
  if (!materialId || !materialName) throw new Error("Missing required fields");
  const docRef = await db.collection("materials").doc(materialId).set({
    materialId, materialName, materialUnit, materialType, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { id: materialId, ...data };
}

async function getMaterials() {
  const snapshot = await db.collection("materials").get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ─────────────────────────────────────────────────────────────────────────
// MATERIAL RECEIVED - WITH BANK PAYMENT (CORRECTED: MINUS from balance)
// ─────────────────────────────────────────────────────────────────────────

async function recordMaterialReceived(data) {
  const {
    projectNo, materialId, materialName, quantity, rate, paidAmount = 0,
    dealerName, date, paymentMethod = "CASH", bankId, bankName,
  } = data;

  if (!projectNo || !materialId || !materialName || quantity <= 0) {
    throw new Error("Missing or invalid required fields");
  }

  const receiptId = `RECEIPT-${Date.now()}`;
  const receivedDoc = {
    receiptId, projectNo, materialId, materialName, quantity,
    rate: rate || 0, totalAmount: (quantity * (rate || 0)),
    paidAmount: paidAmount || 0, dealerName: dealerName || "",
    date: date || new Date().toISOString().split('T')[0],
    paymentMethod: paymentMethod || "CASH",
    bankId: bankId || null, bankName: bankName || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const batch = db.batch();

  // 1. Save material received record
  batch.set(db.collection("materialReceived").doc(receiptId), receivedDoc);

  // 2. Handle BANK payment - DEDUCT from balance
  if (paymentMethod === "BANK" && bankId && paidAmount > 0) {
    await _createMaterialBankTransaction(batch, bankId, bankName, paidAmount, receiptId, materialName, "DEBIT");
  }

  // 3. All materials go to siteExpenses (existing logic)
  await _createMaterialExpense(batch, projectNo, receiptId, dealerName, paidAmount, materialName);

  await batch.commit();

  return receivedDoc;
}

async function updateReceiptPayment(receiptId, updateData) {
  const { paidAmount, paymentMethod, bankId, bankName } = updateData;
  const receiptRef = db.collection("materialReceived").doc(receiptId);
  const oldReceipt = await receiptRef.get();

  if (!oldReceipt.exists) throw new Error("Receipt not found");

  const oldData = oldReceipt.data();
  const oldPaymentMethod = oldData.paymentMethod || "CASH";
  const oldBankId = oldData.bankId;
  const oldPaidAmount = oldData.paidAmount || 0;
  const newPaidAmount = paidAmount || 0;
  const newPaymentMethod = paymentMethod || oldPaymentMethod;
  const newBankId = bankId || oldBankId;

  const batch = db.batch();

  // Update receipt
  batch.update(receiptRef, {
    paidAmount: newPaidAmount, paymentMethod: newPaymentMethod,
    bankId: newBankId, bankName: bankName || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Handle payment method changes
  if (oldPaymentMethod === "CASH" && newPaymentMethod === "CASH") {
    // CASH → CASH: update expense amount
    await _updateExpenseAmount(batch, receiptId, oldPaidAmount, newPaidAmount);
  } else if (oldPaymentMethod === "CASH" && newPaymentMethod === "BANK") {
    // CASH → BANK: delete expense, create bank transaction (DEBIT)
    await _deleteExpense(batch, receiptId);
    await _createMaterialBankTransaction(
      batch, newBankId, bankName, newPaidAmount, receiptId, 
      oldData.materialName, "DEBIT"
    );
  } else if (oldPaymentMethod === "BANK" && newPaymentMethod === "CASH") {
    // BANK → CASH: revert bank balance (CREDIT), create expense
    await _createMaterialBankTransaction(
      batch, oldBankId, oldData.bankName, oldPaidAmount, receiptId, 
      oldData.materialName, "CREDIT"
    );
    await _createMaterialExpense(batch, oldData.projectNo, receiptId, oldData.dealerName, newPaidAmount, oldData.materialName);
  } else if (oldPaymentMethod === "BANK" && newPaymentMethod === "BANK") {
    // BANK → BANK: adjust both banks
    if (oldBankId === newBankId) {
      // Same bank: adjust transaction amount
      const difference = newPaidAmount - oldPaidAmount;
      if (difference !== 0) {
        const txnType = difference > 0 ? "DEBIT" : "CREDIT";
        await _createMaterialBankTransaction(
          batch, newBankId, bankName, Math.abs(difference), receiptId, 
          oldData.materialName, txnType
        );
      }
    } else {
      // Different banks: revert old, create on new
      await _createMaterialBankTransaction(
        batch, oldBankId, oldData.bankName, oldPaidAmount, receiptId, 
        oldData.materialName, "CREDIT"
      );
      await _createMaterialBankTransaction(
        batch, newBankId, bankName, newPaidAmount, receiptId, 
        oldData.materialName, "DEBIT"
      );
    }
  }

  await batch.commit();

  return { ...oldData, paidAmount: newPaidAmount, paymentMethod: newPaymentMethod, bankId: newBankId };
}

async function updateMaterialReceived(receiptId, updateData) {
  const receiptRef = db.collection("materialReceived").doc(receiptId);
  const oldReceipt = await receiptRef.get();

  if (!oldReceipt.exists) throw new Error("Receipt not found");

  const oldData = oldReceipt.data();
  const batch = db.batch();

  // Update receipt
  batch.update(receiptRef, { ...updateData, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

  // Handle BANK payments: adjust balance if amount changed
  if (oldData.paymentMethod === "BANK" && oldData.bankId && updateData.paidAmount) {
    const difference = updateData.paidAmount - oldData.paidAmount;
    if (difference !== 0) {
      const txnType = difference > 0 ? "DEBIT" : "CREDIT";
      await _createMaterialBankTransaction(
        batch, oldData.bankId, oldData.bankName, Math.abs(difference), receiptId,
        oldData.materialName, txnType
      );
    }
  }

  // Update expense if CASH
  if (oldData.paymentMethod === "CASH" && updateData.paidAmount) {
    await _updateExpenseAmount(batch, receiptId, oldData.paidAmount, updateData.paidAmount);
  }

  await batch.commit();

  return { ...oldData, ...updateData };
}

async function deleteMaterialReceived(receiptId) {
  const receiptRef = db.collection("materialReceived").doc(receiptId);
  const receipt = await receiptRef.get();

  if (!receipt.exists) throw new Error("Receipt not found");

  const data = receipt.data();
  const batch = db.batch();

  // Delete receipt
  batch.delete(receiptRef);

  // Handle BANK payments: revert balance (CREDIT)
  if (data.paymentMethod === "BANK" && data.bankId && data.paidAmount > 0) {
    await _createMaterialBankTransaction(
      batch, data.bankId, data.bankName, data.paidAmount, receiptId,
      data.materialName, "CREDIT"
    );
  }

  // Delete expense
  await _deleteExpense(batch, receiptId);

  await batch.commit();

  return { success: true, deletedReceiptId: receiptId };
}

async function getMaterialReceived(projectNo) {
  if (!projectNo) {
    const snapshot = await db.collection("materialReceived").get();
    return snapshot.docs.map(doc => ({ receiptId: doc.id, ...doc.data() }));
  }
  const snapshot = await db.collection("materialReceived").where("projectNo", "==", projectNo).get();
  return snapshot.docs.map(doc => ({ receiptId: doc.id, ...doc.data() }));
}

async function getMaterialReceivedByMaterialId(materialId) {
  const snapshot = await db.collection("materialReceived").where("materialId", "==", materialId).get();
  if (snapshot.empty) throw new Error("No records found for this material");
  return snapshot.docs.map(doc => ({ receiptId: doc.id, ...doc.data() }));
}

// ─────────────────────────────────────────────────────────────────────────
// BANK TRANSACTION HELPER (CORRECTED: DEBIT = MINUS, CREDIT = PLUS)
// ─────────────────────────────────────────────────────────────────────────

async function _createMaterialBankTransaction(batch, bankId, bankName, amount, receiptId, materialName, transactionType) {
  if (!bankId || amount <= 0 || !["DEBIT", "CREDIT"].includes(transactionType)) {
    throw new Error("Invalid transaction parameters");
  }

  const bankRef = db.collection("banks").doc(bankId);
  const bankDoc = await bankRef.get();

  if (!bankDoc.exists) throw new Error("Bank account not found");

  const bankData = bankDoc.data();
  const balanceBefore = bankData.currentBalance || 0;

  // CORRECTED: DEBIT = MINUS from balance, CREDIT = PLUS to balance
  const balanceAfter = transactionType === "DEBIT" ? (balanceBefore - amount) : (balanceBefore + amount);

  // Update bank balance
  batch.update(bankRef, { currentBalance: balanceAfter, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

  // Create transaction record
  const txnRef = db.collection("banks").doc(bankId).collection("transactions").doc(`TXN-${Date.now()}`);
  batch.set(txnRef, {
    type: transactionType,
    amount, projectNo: "", remark: `Material: ${materialName}`,
    date: new Date().toISOString().split('T')[0],
    balanceBefore, balanceAfter,
    transactionType: "MATERIAL_PAYMENT",
    relatedReceiptId: receiptId, materialId: "", materialName,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────────────────────
// SITE EXPENSES HELPERS (EXISTING LOGIC - NO CHANGES)
// ─────────────────────────────────────────────────────────────────────────

async function _createMaterialExpense(batch, projectNo, receiptId, dealerName, amount, materialName) {
  if (!projectNo || amount <= 0) return;

  const expenseId = `EXP-${Date.now()}`;
  const expenseRef = db.collection("siteExpenses").doc(expenseId);

  batch.set(expenseRef, {
    expenseId, projectNo, relatedReceiptId: receiptId,
    type: "MATERIAL", dealerName: dealerName || "",
    amount, amountReceived: amount,
    remark: `Material Purchase: ${materialName}`,
    date: new Date().toISOString().split('T')[0],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function _updateExpenseAmount(batch, receiptId, oldAmount, newAmount) {
  const snapshot = await db.collection("siteExpenses").where("relatedReceiptId", "==", receiptId).limit(1).get();
  if (!snapshot.empty) {
    const expenseRef = snapshot.docs[0].ref;
    batch.update(expenseRef, { amount: newAmount, amountReceived: newAmount });
  }
}

async function _deleteExpense(batch, receiptId) {
  const snapshot = await db.collection("siteExpenses").where("relatedReceiptId", "==", receiptId).get();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
}

// ─────────────────────────────────────────────────────────────────────────
// MATERIAL USED (NO CHANGES)
// ─────────────────────────────────────────────────────────────────────────

async function recordMaterialUsed(data) {
  const { projectNo, materialId, materialName, quantityUsed, date } = data;
  if (!projectNo || !materialId || quantityUsed <= 0) throw new Error("Missing required fields");

  const usageId = `USAGE-${Date.now()}`;
  await db.collection("materialUsed").doc(usageId).set({
    usageId, projectNo, materialId, materialName, quantityUsed,
    date: date || new Date().toISOString().split('T')[0],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { usageId, ...data };
}

async function updateMaterialUsed(usageId, updateData) {
  await db.collection("materialUsed").doc(usageId).update({
    ...updateData, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const doc = await db.collection("materialUsed").doc(usageId).get();
  return { usageId, ...doc.data() };
}

async function deleteMaterialUsed(usageId) {
  await db.collection("materialUsed").doc(usageId).delete();
  return { success: true, deletedUsageId: usageId };
}

// ─────────────────────────────────────────────────────────────────────────
// MATERIAL STOCK
// ─────────────────────────────────────────────────────────────────────────

async function getMaterialStock(projectNo) {
  const receivedSnapshot = await db.collection("materialReceived").where("projectNo", "==", projectNo).get();
  const usedSnapshot = await db.collection("materialUsed").where("projectNo", "==", projectNo).get();

  const stock = {};

  receivedSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const name = data.materialName || data.name;
    if (!stock[name]) stock[name] = { received: 0, used: 0, unit: data.unit || "" };
    stock[name].received += data.quantity || 0;
  });

  usedSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const name = data.materialName || data.name;
    if (!stock[name]) stock[name] = { received: 0, used: 0, unit: "" };
    stock[name].used += data.quantityUsed || 0;
  });

  return Object.entries(stock).map(([name, data]) => ({
    materialName: name, received: data.received, used: data.used,
    balance: data.received - data.used, unit: data.unit,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// MATERIAL REQUIRED (NO CHANGES)
// ─────────────────────────────────────────────────────────────────────────

async function addMaterialRequired(data) {
  const { projectNo, materialId, materialName, requiredQuantity, date } = data;
  if (!projectNo || !materialName || requiredQuantity <= 0) throw new Error("Missing required fields");

  const requiredId = `REQ-${Date.now()}`;
  await db.collection("materialRequired").doc(requiredId).set({
    requiredId, projectNo, materialId, materialName, requiredQuantity,
    date: date || new Date().toISOString().split('T')[0],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { requiredId, ...data };
}

async function getMaterialRequired(projectNo) {
  if (!projectNo) {
    const snapshot = await db.collection("materialRequired").get();
    return snapshot.docs.map(doc => ({ requiredId: doc.id, ...doc.data() }));
  }
  const snapshot = await db.collection("materialRequired").where("projectNo", "==", projectNo).get();
  return snapshot.docs.map(doc => ({ requiredId: doc.id, ...doc.data() }));
}

async function getAllMaterialRequired() {
  const snapshot = await db.collection("materialRequired").get();
  return snapshot.docs.map(doc => ({ requiredId: doc.id, ...doc.data() }));
}

module.exports = {
  createMaterial, getMaterials, recordMaterialReceived, getMaterialReceived,
  getMaterialReceivedByMaterialId, updateReceiptPayment, updateMaterialReceived,
  deleteMaterialReceived, recordMaterialUsed, updateMaterialUsed, deleteMaterialUsed,
  getMaterialStock, addMaterialRequired, getMaterialRequired, getAllMaterialRequired,
};