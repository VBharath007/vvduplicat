const { db } = require("../../config/firebase");

const siteExpensesCollection = db.collection("siteExpenses");
const advancesCollection = db.collection("advances");

exports.createExpense = async (expenseData) => {
    if (!expenseData.projectNo) {
        throw new Error("projectNo is required");
    }

    // Default values
    expenseData.createdAt = new Date().toISOString();
    expenseData.amount = Number(expenseData.amount) || 0;

    // ALWAYS recalculate pastExpense from DB — never trust the client value.
    const snapshot = await siteExpensesCollection
        .where("projectNo", "==", expenseData.projectNo)
        .get();
    let totalPrevious = 0;
    snapshot.forEach(doc => {
        totalPrevious += (Number(doc.data().amount) || 0);
    });
    expenseData.pastExpense = totalPrevious;

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
    let totalProjectExpense = 0;

    snapshot.forEach((doc) => {
        const data = doc.data();
        const amount = Number(data.amount) || 0;
        totalProjectExpense += amount;

        expenses.push({
            expenseId: doc.id,
            ...data,
            // Map fields to match Flutter's FinancialHistoryScreen requirements
            amountReceived: amount,
            remark: data.remark || data.particular || "Site Expense",
            date: data.date || data.createdAt?.split('T')[0]
        });
    });

    return { expenses, totalExpense: totalProjectExpense };
};

exports.updateExpense = async (id, updateData) => {
    const docRef = siteExpensesCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new Error("Expense record not found");
    }

    // Clean data
    if (updateData.amount !== undefined) updateData.amount = Number(updateData.amount);
    delete updateData.expenseId;
    delete updateData.createdAt;

    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    return { expenseId: id, ...updatedDoc.data() };
};

exports.deleteExpense = async (id) => {
    const docRef = siteExpensesCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new Error("Expense record not found");
    }
    await docRef.delete();
    return { message: "Expense record deleted successfully" };
};

exports.getFinancialHistory = async (projectNo) => {
    const projectService = require("../project/project.service");
    return projectService.getFinancialHistory(projectNo);
};
