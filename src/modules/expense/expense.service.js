const { db } = require("../../config/firebase");

const siteExpensesCollection = db.collection("siteExpenses");

exports.createExpense = async (expenseData) => {
    if (!expenseData.projectNo) {
        throw new Error("projectNo is required");
    }

    // Default values
    expenseData.createdAt = new Date().toISOString();
    expenseData.amount = Number(expenseData.amount) || 0;

    // Automatically calculate pastExpense from previous entries if not provided
    if (expenseData.pastExpense === undefined || expenseData.pastExpense === null) {
        const snapshot = await siteExpensesCollection.where("projectNo", "==", expenseData.projectNo).get();
        let totalPrevious = 0;
        snapshot.forEach(doc => {
            totalPrevious += (Number(doc.data().amount) || 0);
        });
        expenseData.pastExpense = totalPrevious;
    } else {
        expenseData.pastExpense = Number(expenseData.pastExpense) || 0;
    }

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
