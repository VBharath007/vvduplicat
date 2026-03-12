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
        const pastExpense = Number(data.pastExpense) || 0;

        // Current overall total for this record (add add)
        const rowTotal = amount + pastExpense;
        
        totalProjectExpense += amount; // Sum only current to avoid double counting

        expenses.push({ 
            expenseId: doc.id, 
            ...data,
            rowTotal: rowTotal // show as overall/total for this record
        });
    });
    
    return { 
        expenses, 
        totalExpense: totalProjectExpense 
    };
};
