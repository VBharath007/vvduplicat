const { db } = require("../../config/firebase");
const dayjs = require("dayjs");

const approvalsCollection = db.collection("approvals");
const approvalAdvancesCollection = db.collection("approvalAdvances");
const approvalExpensesCollection = db.collection("approvalExpenses");
const projectTypeCollection = db.collection("projectTypeOptions");


const DEFAULT_PROJECT_TYPE = [
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


const getCurrentDate = () => dayjs().format("DD-MM-YYYY");

// Initialize default types if they don't exist
const initializeProjectTypes = async () => {
    try {
        const snap = await projectTypeCollection.get();
        if (snap.empty) {
            const batch = db.batch();
            DEFAULT_PROJECT_TYPE.forEach(type => {
                const docRef = projectTypeCollection.doc();
                batch.set(docRef, {
                    name: type.toUpperCase(),
                    status: "approved",
                    createdAt: new Date().toISOString()
                });
            });
            await batch.commit();
        }
    } catch (error) {
        console.error("Failed to initialize project types:", error);
    }
};

// Call initialization
initializeProjectTypes();

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


const ensureProjectTypeExists = async (type) => {
    if (!type) return;
    const upperType = type.toUpperCase();
    const snap = await projectTypeCollection.where("name", "==", upperType).get();
    if (snap.empty) {
        await projectTypeCollection.add({
            name: upperType,
            status: "approved",
            createdAt: new Date().toISOString()
        });
    }
};

exports.createApproval = async (data) => {
    if (!data.projectNo) throw new Error("projectNo is required");

    // ✅ FIX: Only use projectType, do NOT treat workStatus as a projectType fallback
    const pType = data.projectType;
    if (pType) await ensureProjectTypeExists(pType);

    const docRef = approvalsCollection.doc(data.projectNo);
    const doc = await docRef.get();
    if (doc.exists) {
        throw new Error("Approval for this projectNo already exists");
    }

    const newApproval = {
        ...data,
        projectType: pType || "",
        // ✅ FIX: workStatus is preserved from ...data, NOT deleted
        createdAt: getCurrentDate(),
        statusTracking: data.statusTracking || { currentStatus: "ongoing" },
        financialDetails: data.financialDetails || { totalFees: 0 }
    };

    await docRef.set(newApproval);
    return { id: data.projectNo, ...newApproval };
};

exports.getApprovals = async () => {
  const snap = await approvalsCollection.get();

  let approvals = [];

  for (const doc of snap.docs) {
    const data = doc.data();

    const num = parseInt(
      (data.projectNo || "VVD0000").replace("VVD", "")
    ) || 0;

    approvals.push({
      id: doc.id,
      ...data,
      _index: num,
    });
  }

  approvals.sort((a, b) => b._index - a._index);

  return approvals.map(a => {
    delete a._index;
    return a;
  });
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

    // ✅ FIX: Only use projectType, do NOT treat workStatus as a projectType fallback
    const pType = updateData.projectType;
    if (pType) {
        await ensureProjectTypeExists(pType);
    }
    // ✅ FIX: workStatus stays in updateData as its own field, NOT deleted

    await docRef.update(updateData);
    return this.getApprovalById(id);
};
exports.getNextApprovalNo = async () => {
  const snap = await approvalsCollection.get();

  let max = 0;

  snap.forEach(doc => {
    const pNo = doc.data().projectNo || "VVD0000";
    const num = parseInt(pNo.replace("VVD", "")) || 0;

    if (num > max) max = num;
  });

  const next = max + 1;

  return `VVD${String(next).padStart(4, "0")}`;
};
// --- Advances --- //
exports.addAdvance = async (id, payload) => {
    let docRef = approvalsCollection.doc(id);
    let doc = await docRef.get();

    if (!doc.exists) {
        const snap = await approvalsCollection.where("projectNo", "==", id).get();
        if (snap.empty) throw new Error("Approval not found");
        docRef = snap.docs[0].ref;
    }

    const advances = payload.approvalAdvancePaidFees || payload;
    const advancesArray = Array.isArray(advances) ? advances : [advances];

    const additionalAmount = advancesArray.reduce((sum, a) => sum + (Number(a.amountReceived) || 0), 0);
    const currentApproval = await this.getApprovalById(id);
    const totalFees = Number(currentApproval.financialDetails?.totalFees) || 0;
    const currentlyPaid = currentApproval.calculations.advancedPaid;

    if (currentlyPaid + additionalAmount > totalFees) {
        throw new Error(`Total advances (${currentlyPaid + additionalAmount}) cannot exceed Total Fees (${totalFees})`);
    }

    const batch = db.batch();
    const addedAdvances = [];

    advancesArray.forEach(advance => {
        const docRef = approvalAdvancesCollection.doc();
        const data = {
            approvalId: id,
            sno: advance.sno,
            date: advance.date || getCurrentDate(),
            amountReceived: Number(advance.amountReceived) || 0,
            remark: advance.remark || "",
            modeOfPayment: advance.modeOfPayment,
            createdAt: getCurrentDate()
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
            date: expense.date || getCurrentDate(),
            particularRemark: expense.particularRemark || "",
            amount: Number(expense.amount) || 0,
            createdAt: getCurrentDate()
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

exports.updateExpense = async (expenseId, updateData) => {
    const docRef = approvalExpensesCollection.doc(expenseId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error("Expense not found");
    }

    await docRef.update({
        particularRemark: updateData.particularRemark,
        amount: Number(updateData.amount),
        date: updateData.date
    });

    return { message: "Expense updated successfully" };
};

exports.deleteExpense = async (expenseId) => {
    const docRef = approvalExpensesCollection.doc(expenseId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error("Expense not found");
    }

    await docRef.delete();
    return { message: "Expense deleted successfully" };
};

exports.updateAdvance = async (advanceId, updateData) => {
    const docRef = approvalAdvancesCollection.doc(advanceId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error("Advance not found");
    }

    await docRef.update({
        amountReceived: Number(updateData.amountReceived),
        remark: updateData.remark,
        date: updateData.date
    });

    return { message: "Advance updated successfully" };
};

exports.deleteAdvance = async (advanceId) => {
    const docRef = approvalAdvancesCollection.doc(advanceId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error("Advance not found");
    }

    await docRef.delete();
    return { message: "Advance deleted successfully" };
};

exports.updateTotalFees = async (req, res) => {
    try {
        const { id } = req.params;
        const { totalFees } = req.body;

        const docRef = approvalsCollection.doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Approval not found" });
        }

        const calculations = await getApprovalCalculations(id, totalFees);
        if (Number(totalFees) < calculations.advancedPaid) {
            return res.status(400).json({
                error: `Total fees (${totalFees}) cannot be less than advanced amount already paid (${calculations.advancedPaid})`
            });
        }

        await docRef.update({
            "financialDetails.totalFees": Number(totalFees)
        });

        res.json({
            message: "Total fees updated successfully",
            calculations
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.confirmProjectType = async (id) => {
    const docRef = projectTypeCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Project type not found");

    await docRef.update({ status: "approved" });
    return { message: "Project type confirmed successfully" };
};

exports.deleteProjectType = async (id) => {
    const docRef = projectTypeCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Project type not found");

    await docRef.delete();
    return { message: "Project type deleted successfully" };
};

exports.getProjectTypes = async () => {
    const snap = await projectTypeCollection.get();

    const typesFromDb = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    return typesFromDb
        .filter(s => s.status === "approved" || !s.status)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
};

exports.addProjectType = async (name) => {
    if (!name) throw new Error("Project type name required");
    const upperName = name.toUpperCase();

    const existingSnap = await projectTypeCollection
        .where("name", "==", upperName)
        .get();

    if (!existingSnap.empty) {
        return { message: "Project type already exists", alreadyExists: true };
    }

    const docRef = await projectTypeCollection.add({
        name: upperName,
        status: "approved",
        createdAt: new Date().toISOString()
    });

    return { id: docRef.id, message: "Project type added successfully" };
};

// --- Date Range Summary --- //
exports.getSummaryByDateRange = async (startDate, endDate) => {
    if (!startDate || !endDate) {
        throw new Error("startDate and endDate are required (DD-MM-YYYY)");
    }

    // Parse query param dates (DD-MM-YYYY)
    const parseQueryDate = (str) => {
        const [d, m, y] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    };

    const start = parseQueryDate(startDate);
    const end   = parseQueryDate(endDate);

    // Set end to end of day so records created on endDate are included
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("Invalid date format. Use DD-MM-YYYY");
    }
    if (start > end) {
        throw new Error("startDate must be before or equal to endDate");
    }

    // Parse createdAt from Firestore — handles BOTH formats:
    // 1. "DD-MM-YYYY"          ← your app's format (new records)
    // 2. "2025-03-28T10:..."   ← ISO string (older records)
    // 3. Firestore Timestamp   ← if stored as Timestamp object
    const parseCreatedAt = (createdAt) => {
        if (!createdAt) return null;

        // Firestore Timestamp object
        if (typeof createdAt === "object" && createdAt._seconds) {
            return new Date(createdAt._seconds * 1000);
        }
        if (typeof createdAt === "object" && createdAt.toDate) {
            return createdAt.toDate();
        }

        if (typeof createdAt === "string") {
            // DD-MM-YYYY format
            if (/^\d{2}-\d{2}-\d{4}$/.test(createdAt)) {
                const [d, m, y] = createdAt.split("-").map(Number);
                return new Date(y, m - 1, d);
            }
            // ISO string or any other string format
            const parsed = new Date(createdAt);
            if (!isNaN(parsed.getTime())) return parsed;
        }

        return null;
    };

    const snap = await approvalsCollection.orderBy("projectNo", "asc").get();

    let totalAdvancedPaid = 0;
    let totalExpensePaid  = 0;
    let totalFees         = 0;
    let totalFinalBalance = 0;
    const projects        = [];

    for (const doc of snap.docs) {
        const data = doc.data();

        const created = parseCreatedAt(data.createdAt);

        // Skip if date can't be parsed or is outside range
        if (!created || created < start || created > end) continue;

        const calcs = await getApprovalCalculations(
            doc.id,
            data.financialDetails?.totalFees
        );

        const projectFees = Number(data.financialDetails?.totalFees) || 0;

        totalAdvancedPaid += calcs.advancedPaid;
        totalExpensePaid  += calcs.expensePaid;
        totalFees         += projectFees;
        totalFinalBalance += calcs.finalBalance;

        projects.push({
            id:           doc.id,
            projectNo:    data.projectNo,
            clientName:   data.clientName || "",
            projectType:  data.projectType || "",
            createdAt:    data.createdAt,
            status:       data.statusTracking?.currentStatus || "ongoing",
            totalFees:    projectFees,
            advancedPaid: calcs.advancedPaid,
            expensePaid:  calcs.expensePaid,
            amountLeft:   calcs.amountLeft,
            finalBalance: calcs.finalBalance,
        });
    }

    return {
        dateRange: { startDate, endDate },
        summary: {
            totalProjects:    projects.length,
            totalFees,
            totalAdvancedPaid,
            totalExpensePaid,
            totalAmountLeft:  totalAdvancedPaid - totalExpensePaid,
            totalFinalBalance,
        },
        projects,
    };
};