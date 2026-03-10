const { db } = require("../../config/firebase");

const siteExpensesCollection = db.collection("siteExpenses");

exports.createExpense = async (expenseData) => {
    if (!expenseData.projectNo) {
        throw new Error("projectNo is required");
    }

    // Default values
    expenseData.createdAt = new Date().toISOString();
    expenseData.amount = Number(expenseData.amount) || 0;

    const docRef = await siteExpensesCollection.add(expenseData);
    return { expenseId: docRef.id, ...expenseData };
};

exports.getExpenses = async (projectNo) => {
    let query = siteExpensesCollection;
    if (projectNo) {
        query = query.where("projectNo", "==", projectNo);
    }
    const snapshot = await query.get();
    const expenses = [];
    snapshot.forEach((doc) => {
        expenses.push({ expenseId: doc.id, ...doc.data() });
    });
    return expenses;
};
