const { db } = require("../../config/firebase");

const approvalsCollection = db.collection("approvals");
const approvalAdvancesCollection = db.collection("approvalAdvances");
const approvalExpensesCollection = db.collection("approvalExpenses");
const workStatusCollection = db.collection("workStatusOptions");

const DEFAULT_WORK_STATUSES = [
    "DTCP - SINGLE PLOT",
    "DTCP - LAYOUT",
    "LPA - COMMERCIAL",
    "LPA - RESIDENTIAL",
    "CORPORATION - COMMERCIAL AC LEVEL",
    "CORPORATION - COMMERCIAL COMMISSION LEVEL",
    "CORPORATION - RESIDENTIAL AC LEVEL",
    "CORPORATION - RESIDENTIAL COMMISSION LEVEL",
    "SELF CERTIFICATION",
    "CONCEPT PLAN",
    "ELEVATION",
    "ESTIMATION",
    "STRUCTURAL",
    "BLUEPRINT",
    "OTHERS"
];

// Initialize default statuses if they don't exist
const initializeWorkStatuses = async () => {
    try {
        const snap = await workStatusCollection.get();
        if (snap.empty) {
            const batch = db.batch();
            DEFAULT_WORK_STATUSES.forEach(status => {
                const docRef = workStatusCollection.doc();
                batch.set(docRef, { name: status });
            });
            await batch.commit();
        }
    } catch (error) {
        console.error("Failed to initialize work statuses:", error);
    }
};

// Call initialization
initializeWorkStatuses();

// Utility function to get calculations
const getApprovalCalculations = async (approvalId, totalFees) => {
    // Get advances
    const advancesSnap = await approvalAdvancesCollection.where("approvalId", "==", approvalId).get();
    let advancedPaid = 0;
    advancesSnap.forEach(doc => {
        advancedPaid += Number(doc.data().amountReceived) || 0;
    });

    // Get expenses
    const expensesSnap = await approvalExpensesCollection.where("approvalId", "==", approvalId).get();
    let expensePaid = 0;
    expensesSnap.forEach(doc => {
        expensePaid += Number(doc.data().amount) || 0;
    });

    const amountLeft = advancedPaid - expensePaid;
    const finalBalance = (Number(totalFees) || 0) - advancedPaid;

    return {
        advancedPaid,
        expensePaid,
        amountLeft,
        finalBalance
    };
};

const ensureWorkStatusExists = async (status) => {
    if (!status) return;
    const upperStatus = status.toUpperCase();
    const snap = await workStatusCollection.where("name", "==", upperStatus).get();
    if (snap.empty) {
        await workStatusCollection.add({ name: upperStatus });
    }
};

exports.createApproval = async (data) => {
    if (!data.projectNo) throw new Error("projectNo is required");

    await ensureWorkStatusExists(data.workStatus);

    const docRef = approvalsCollection.doc(data.projectNo);
    const doc = await docRef.get();
    if (doc.exists) {
        throw new Error("Approval for this projectNo already exists");
    }

    const newApproval = {
        ...data,
        createdAt: new Date().toISOString(),
        statusTracking: data.statusTracking || { currentStatus: "ongoing" },
        financialDetails: data.financialDetails || { totalFees: 0 }
    };

    await docRef.set(newApproval);
    return { id: data.projectNo, ...newApproval };
};

exports.getApprovals = async () => {
    const snap = await approvalsCollection.get();
    const approvals = [];

    // We can also fetch calculations for each, but it might be heavy. Let's return basic and they can get details by ID.
    // Or we enhance it with calculations. Let's just return what is requested or add basic calculations.
    for (const doc of snap.docs) {
        const data = doc.data();
        const calcs = await getApprovalCalculations(doc.id, data.financialDetails?.totalFees);
        approvals.push({ id: doc.id, ...data, calculations: calcs });
    }
    return approvals;
};

exports.getApprovalById = async (id) => {
    let doc = await approvalsCollection.doc(id).get();
    if (!doc.exists) {
        const snap = await approvalsCollection.where("projectNo", "==", id).get();
        if (snap.empty) throw new Error("Approval not found");
        doc = snap.docs[0];
    }

    const data = doc.data();
    const calcs = await getApprovalCalculations(id, data.financialDetails?.totalFees);
    return { id: doc.id, ...data, calculations: calcs };
};

exports.updateApproval = async (id, updateData) => {
    let docRef = approvalsCollection.doc(id);
    let doc = await docRef.get();
    if (!doc.exists) {
        const snap = await approvalsCollection.where("projectNo", "==", id).get();
        if (snap.empty) throw new Error("Approval not found");
        docRef = snap.docs[0].ref;
    }

    if (updateData.workStatus) {
        await ensureWorkStatusExists(updateData.workStatus);
    }

    await docRef.update(updateData);
    return this.getApprovalById(id);
};

// --- Advances --- //
exports.addAdvance = async (id, payload) => {
    // fallback: if project doesn't exist using id, try where projectNo=id just in case
    let docRef = approvalsCollection.doc(id);
    let doc = await docRef.get();

    if (!doc.exists) {
        // Just in case they created an approval using an auto-ID earlier
        const snap = await approvalsCollection.where("projectNo", "==", id).get();
        if (snap.empty) throw new Error("Approval not found");
        docRef = snap.docs[0].ref;
    }

    const advances = payload.approvalAdvancePaidFees || payload;
    const advancesArray = Array.isArray(advances) ? advances : [advances];
    const batch = db.batch();
    const addedAdvances = [];

    advancesArray.forEach(advance => {
        const docRef = approvalAdvancesCollection.doc();
        const data = {
            approvalId: id,
            sno: advance.sno,
            date: advance.date || new Date().toISOString(),
            amountReceived: Number(advance.amountReceived) || 0,
            remark: advance.remark || "",
            modeOfPayment: advance.modeOfPayment,
            createdAt: new Date().toISOString()
        };
        batch.set(docRef, data);
        addedAdvances.push({ id: docRef.id, ...data });
    });

    await batch.commit();
    return addedAdvances;
};

exports.getAdvances = async (id) => {
    const snap = await approvalAdvancesCollection.where("approvalId", "==", id).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- Expenses --- //
exports.addExpense = async (id, payload) => {
    let docRef = approvalsCollection.doc(id);
    let doc = await docRef.get();

    if (!doc.exists) {
        const snap = await approvalsCollection.where("projectNo", "==", id).get();
        if (snap.empty) throw new Error("Approval not found");
        docRef = snap.docs[0].ref;
    }

    const expenses = payload.approvalExpenses || payload;
    const expensesArray = Array.isArray(expenses) ? expenses : [expenses];
    const batch = db.batch();
    const addedExpenses = [];

    expensesArray.forEach(expense => {
        const docRef = approvalExpensesCollection.doc();
        const data = {
            approvalId: id,
            sno: expense.sno,
            date: expense.date || new Date().toISOString(),
            particularRemark: expense.particularRemark || "",
            amount: Number(expense.amount) || 0,
            createdAt: new Date().toISOString()
        };
        batch.set(docRef, data);
        addedExpenses.push({ id: docRef.id, ...data });
    });

    await batch.commit();
    return addedExpenses;
};

exports.getExpenses = async (id) => {
    const snap = await approvalExpensesCollection.where("approvalId", "==", id).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- Status Update --- //
exports.updateStatus = async (id, currentStatus) => {
    let docRef = approvalsCollection.doc(id);
    let doc = await docRef.get();

    if (!doc.exists) {
        const snap = await approvalsCollection.where("projectNo", "==", id).get();
        if (snap.empty) throw new Error("Approval not found");
        docRef = snap.docs[0].ref;
    }

    await docRef.update({
        "statusTracking.currentStatus": currentStatus
    });

    return this.getApprovalById(id);
};
