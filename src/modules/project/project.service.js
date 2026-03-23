const { db } = require("../../config/firebase");

const projectsCollection = db.collection("projects");
const worksCollection = db.collection("works");
const materialReceivedCollection = db.collection("materialReceived");
const materialUsedCollection = db.collection("materialUsed");
const siteExpensesCollection = db.collection("siteExpenses");
const advancesCollection = db.collection("advances");

// ─── Shared Financial Helper ──────────────────────────────────────────────────
//
//  SINGLE SOURCE OF TRUTH — used by getProjectSummary AND getFinancialHistory.
//  Numbers will NEVER differ between the two screens.
//
//  FINANCIAL LOGIC:
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │  totalAdvance        = SUM(advances.amountReceived)                     │
//  │                        (fallback → project.paymentDetails.advancedPaid) │
//  │                                                                         │
//  │  siteExpenseTotal    = SUM(siteExpenses WHERE type ≠ "materialPayment") │
//  │  materialPayTotal    = SUM(siteExpenses WHERE type  = "materialPayment") │
//  │  totalExpense        = siteExpenseTotal + materialPayTotal               │
//  │                                                                         │
//  │  amountLeft (balance) = totalAdvance − totalExpense                     │
//  └─────────────────────────────────────────────────────────────────────────┘
//
//  EXPENSE TYPES stored in siteExpenses:
//    "materialPayment"  → auto-created by material_service when paidAmount > 0
//    (anything else)    → manually entered site expenses
//
// ─────────────────────────────────────────────────────────────────────────────
async function _getFinancials(projectNo, projectData) {
    // Parallel fetch for performance
    const [advanceSnap, expenseSnap] = await Promise.all([
        advancesCollection.where("projectNo", "==", projectNo).get(),
        siteExpensesCollection.where("projectNo", "==", projectNo).get(),
    ]);

    // ── 1. Build Advance history ──────────────────────────────────────────────
    const advances = [];
    let totalAdvance = 0;

    advanceSnap.forEach(doc => {
        const data = doc.data();
        const amount = Number(data.amountReceived) || 0;
        totalAdvance += amount;
        advances.push({
            id: doc.id,
            type: "Advance",
            amount,
            remark: data.remark || "Project Advance",
            date: data.date || data.createdAt?.split("T")[0],
            createdAt: data.createdAt,
            modeOfPayment: data.modeOfPayment,
            sno: data.sno,
        });
    });

    // Fallback: no dynamic advances yet → use static field on project doc
    if (totalAdvance === 0 && projectData) {
        const staticAdvance = Number(projectData.paymentDetails?.advancedPaid) || 0;
        if (staticAdvance > 0) {
            totalAdvance = staticAdvance;
            advances.push({
                id: "initial",
                type: "Advance",
                amount: staticAdvance,
                remark: "Initial Advance",
                date: projectData.createdAt?.split("T")[0],
                createdAt: projectData.createdAt,
                modeOfPayment: "Initial",
                sno: 1,
            });
        }
    }

    // ── 2. Build Expense history (split by type) ──────────────────────────────
    const siteExpenses = [];   // manual expenses entered by user
    const materialPayments = [];   // auto-created from material paidAmount
    let siteExpenseTotal = 0;
    let materialPayTotal = 0;

    expenseSnap.forEach(doc => {
        const data = doc.data();
        const amount = Number(data.amount) || 0;

        const entry = {
            id: doc.id,
            amount,
            remark: data.remark || data.particular || "Expense",
            particular: data.particular,
            date: data.date || data.createdAt?.split("T")[0],
            createdAt: data.createdAt,
            materialId: data.materialId || null,
            receiptId: data.receiptId || null,
            labourId: data.labourId || null,
            labourName: data.labourName || null,
        };

        if (data.type === "materialPayment") {
            // ── Material payment: advance paid to supplier ─────────────────
            entry.type = "MaterialPayment";
            entry.remark = data.remark || `Material Payment – ${data.particular || data.materialId}`;
            materialPayTotal += amount;
            materialPayments.push(entry);
        } else if (data.type === "labourPayment") {
            // ── Labour payment: weekly payment to labour ───────────────────
            entry.type = "LabourPayment";
            entry.remark = data.remark || `Labour Payment – ${data.labourName || data.labourId}`;
            siteExpenseTotal += amount;
            siteExpenses.push(entry);
        } else {
            // ── Regular site expense ───────────────────────────────────────
            entry.type = "Expense";
            siteExpenseTotal += amount;
            siteExpenses.push(entry);
        }
    });

    // Combined expense list for history view (both types together)
    const allExpenses = [...siteExpenses, ...materialPayments];
    const totalExpense = siteExpenseTotal + materialPayTotal;
    const balance = totalAdvance - totalExpense;

    // ── 3. Full combined timeline sorted latest-first ─────────────────────────
    const history = [...advances, ...allExpenses].sort((a, b) =>
        new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)
    );

    return {
        totalAdvance,
        siteExpenseTotal,      // manual site expenses only
        materialPayTotal,      // material supplier payments only
        totalExpense,          // siteExpenseTotal + materialPayTotal
        balance,               // amountLeft = totalAdvance − totalExpense
        advances,
        siteExpenses,
        materialPayments,
        expenses: allExpenses, // backward-compatible: all expenses combined
        history,
    };
}


// ─── Project CRUD ─────────────────────────────────────────────────────────────

exports.createProject = async (projectData) => {
    if (!projectData.projectNo) throw new Error("projectNo is required");

    const docRef = projectsCollection.doc(projectData.projectNo);
    const doc = await docRef.get();
    if (doc.exists) throw new Error("Project with this projectNo already exists");

    projectData.createdAt = new Date().toISOString();
    await docRef.set(projectData);
    return { ...projectData };
};

exports.getAllProjects = async () => {
    const snapshot = await projectsCollection.get();
    const projects = [];
    snapshot.forEach(doc => projects.push(doc.data()));
    return projects;
};

exports.getProjectByNo = async (projectNo) => {
    const docRef = projectsCollection.doc(projectNo);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Project not found");
    return doc.data();
};

exports.updateProject = async (projectNo, updateData) => {
    const docRef = projectsCollection.doc(projectNo);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Project not found");

    delete updateData.projectNo;
    delete updateData.createdAt;

    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    return updatedDoc.data();
};

exports.deleteProject = async (projectNo) => {
    const docRef = projectsCollection.doc(projectNo);
    const doc = await docRef.get();

    // ── Check project exists ─────────────────────────────────────────────────
    if (!doc.exists) {
        throw new Error(`Project '${projectNo}' not found`);
    }

    // ── Helper: delete all docs in a query ───────────────────────────────────
    const deleteQuery = async (query, label) => {
        const snap = await query.get();

        if (snap.empty) {
            console.log(`No ${label} found for ${projectNo} — skipping`);
            return 0;
        } else {
            const batch = db.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            console.log(`Deleted ${snap.size} ${label} for ${projectNo}`);
            return snap.size;
        }
    };

    // ── Cascade delete — all project-related data ────────────────────────────
    let works = 0, received = 0, used = 0, expenses = 0;
    let advances = 0, payments = 0, required = 0, stockDeleted = 0;

    // Works
    works = await deleteQuery(
        worksCollection.where("projectNo", "==", projectNo), "works"
    );

    // Material Received
    received = await deleteQuery(
        materialReceivedCollection.where("projectNo", "==", projectNo), "materialReceived"
    );

    // Material Used
    used = await deleteQuery(
        materialUsedCollection.where("projectNo", "==", projectNo), "materialUsed"
    );

    // Site Expenses
    expenses = await deleteQuery(
        siteExpensesCollection.where("projectNo", "==", projectNo), "siteExpenses"
    );

    // Advances
    advances = await deleteQuery(
        advancesCollection.where("projectNo", "==", projectNo), "advances"
    );

    // Labour Payments
    payments = await deleteQuery(
        labourPaymentsCollection.where("projectNo", "==", projectNo), "labourPayments"
    );

    // Material Required
    required = await deleteQuery(
        materialRequiredCollection.where("projectNo", "==", projectNo), "materialRequired"
    );

    // Stock
    stockDeleted = await deleteQuery(
        stockCollection.where("projectNo", "==", projectNo), "stock"
    );

    // ── Finally delete the project itself ────────────────────────────────────
    await docRef.delete();
    console.log(`Project '${projectNo}' deleted successfully`);

    // ── Response ─────────────────────────────────────────────────────────────
    return {
        message: `Project '${projectNo}' and all related data deleted successfully`,
        deleted: {
            works,
            materialReceived: received,
            materialUsed: used,
            siteExpenses: expenses,
            advances,
            labourPayments: payments,
            materialRequired: required,
            stock: stockDeleted,
        }
    };
};


// ─── Project Summary ──────────────────────────────────────────────────────────
//
//  Returns:
//    materialStock   – per-material received / used / stock breakdown
//    financialSummary:
//      totalMaterialPayment  – total paid to suppliers (from material receipts)
//      totalSiteExpense      – total manual site expenses
//      totalExpense          – sum of both above
//      advancedPaid          – total advance received from client
//      amountLeft            – advancedPaid − totalExpense
//
exports.getProjectSummary = async (projectNo) => {
    const docRef = projectsCollection.doc(projectNo);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Project not found");
    const project = doc.data();

    // ── Material stock ────────────────────────────────────────────────────────
    const [receivedSnap, usedSnap] = await Promise.all([
        materialReceivedCollection.where("projectNo", "==", projectNo).get(),
        materialUsedCollection.where("projectNo", "==", projectNo).get(),
    ]);

    const receivedMap = {};

    receivedSnap.forEach(doc => {
        const data = doc.data();
        if (!receivedMap[data.materialId]) {
            receivedMap[data.materialId] = {
                materialName: data.materialName,
                receivedQuantity: 0,
                usedQuantity: 0,
                totalAmount: 0,   // total value of material received
                totalPaid: 0,   // total paid to supplier so far
            };
        }
        receivedMap[data.materialId].receivedQuantity += Number(data.quantity) || 0;
        receivedMap[data.materialId].totalAmount += Number(data.totalAmount) || 0;
        receivedMap[data.materialId].totalPaid += Number(data.paidAmount) || 0;
    });

    usedSnap.forEach(doc => {
        const data = doc.data();
        if (!receivedMap[data.materialId]) {
            receivedMap[data.materialId] = {
                materialName: data.materialName,
                receivedQuantity: 0,
                usedQuantity: 0,
                totalAmount: 0,
                totalPaid: 0,
            };
        }
        receivedMap[data.materialId].usedQuantity += Number(data.quantityUsed) || 0;
    });

    const materialStock = Object.values(receivedMap).map(m => ({
        materialName: m.materialName,
        receivedQuantity: m.receivedQuantity,
        usedQuantity: m.usedQuantity,
        stock: m.receivedQuantity - m.usedQuantity,
        totalAmount: m.totalAmount,
        totalPaid: m.totalPaid,
        dueAmount: m.totalAmount - m.totalPaid,  // still owed to supplier
    }));

    // ── Financial summary via shared helper ───────────────────────────────────
    const financials = await _getFinancials(projectNo, project);

    return {
        projectDetails: project,
        materialStock,
        financialSummary: {
            // ── Expense breakdown ──────────────────────────────────────────
            totalMaterialPayment: financials.materialPayTotal,  // paid to suppliers
            totalSiteExpense: financials.siteExpenseTotal,  // manual site expenses
            totalExpense: financials.totalExpense,      // combined total
            // ── Advance & balance ──────────────────────────────────────────
            advancedPaid: financials.totalAdvance,
            amountLeft: financials.balance,           // advance − totalExpense
        },
    };
};


// ─── Financial History ────────────────────────────────────────────────────────
//
//  Returns the full timeline of advances, site expenses, and material payments.
//  The `summary` block mirrors the numbers shown on the Project Summary screen.
//
exports.getFinancialHistory = async (projectNo) => {
    if (!projectNo) throw new Error("projectNo is required");

    const projectDoc = await projectsCollection.doc(projectNo).get();
    const projectData = projectDoc.exists ? projectDoc.data() : null;

    const financials = await _getFinancials(projectNo, projectData);

    return {
        projectNo,
        summary: {
            totalAdvance: financials.totalAdvance,
            totalMaterialPayment: financials.materialPayTotal,
            totalSiteExpense: financials.siteExpenseTotal,
            totalExpense: financials.totalExpense,
            amountLeft: financials.balance,     // ← this is what Flutter shows as "Amount Left"
        },
        history: financials.history,          // combined timeline, latest first
        advances: financials.advances,
        siteExpenses: financials.siteExpenses,     // manual expenses only
        materialPayments: financials.materialPayments, // auto-expenses from material receipts
        expenses: financials.expenses,         // all expenses combined (backward-compat)
    };
};