const { db } = require("../../config/firebase");

const projectsCollection = db.collection("projects");
const worksCollection = db.collection("works");
const materialReceivedCollection = db.collection("materialReceived");
const materialUsedCollection = db.collection("materialUsed");
const siteExpensesCollection = db.collection("siteExpenses");
const advancesCollection = db.collection("advances");

// ─── Shared Financial Helper ──────────────────────────────────────────────────
// Single source of truth for advances + expenses.
// Used by BOTH getProjectSummary and getFinancialHistory so numbers never differ.
//
// Logic:
//   totalAdvance = SUM of all advances.amountReceived for this project
//                 (if 0, fallback to project.paymentDetails.advancedPaid)
//   totalExpense = SUM of all siteExpenses.amount for this project
//   balance      = totalAdvance - totalExpense
// ─────────────────────────────────────────────────────────────────────────────
async function _getFinancials(projectNo, projectData) {
    // Fetch both collections in parallel for speed
    const [advanceSnap, expenseSnap] = await Promise.all([
        advancesCollection.where("projectNo", "==", projectNo).get(),
        siteExpensesCollection.where("projectNo", "==", projectNo).get(),
    ]);

    // Build advance history list
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

    // Fallback: if no dynamic advance entries yet, use the static field
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

    // Build expense history list
    const expenses = [];
    let totalExpense = 0;
    expenseSnap.forEach(doc => {
        const data = doc.data();
        const amount = Number(data.amount) || 0;
        totalExpense += amount;
        expenses.push({
            id: doc.id,
            type: "Expense",
            amount,
            remark: data.remark || data.particular || "Site Expense",
            date: data.date || data.createdAt?.split("T")[0],
            createdAt: data.createdAt,
            particular: data.particular,
        });
    });

    const balance = totalAdvance - totalExpense;

    // Combined history sorted latest first
    const history = [...advances, ...expenses].sort((a, b) =>
        new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)
    );

    return {
        totalAdvance,
        totalExpense,
        balance,
        advances,
        expenses,
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
    if (!doc.exists) throw new Error("Project not found");
    await docRef.delete();
    return { message: "Project deleted successfully" };
};

// ─── Project Summary ──────────────────────────────────────────────────────────
// Returns material stock + financial summary using the shared helper.
exports.getProjectSummary = async (projectNo) => {
    const docRef = projectsCollection.doc(projectNo);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Project not found");
    const project = doc.data();

    // Materials Received
    const receivedSnap = await materialReceivedCollection
        .where("projectNo", "==", projectNo).get();
    const receivedMap = {};
    receivedSnap.forEach(doc => {
        const data = doc.data();
        if (!receivedMap[data.materialId]) {
            receivedMap[data.materialId] = {
                materialName: data.materialName,
                receivedQuantity: 0,
                usedQuantity: 0,
            };
        }
        receivedMap[data.materialId].receivedQuantity += Number(data.quantity) || 0;
    });

    // Materials Used
    const usedSnap = await materialUsedCollection
        .where("projectNo", "==", projectNo).get();
    usedSnap.forEach(doc => {
        const data = doc.data();
        if (!receivedMap[data.materialId]) {
            receivedMap[data.materialId] = {
                materialName: data.materialName,
                receivedQuantity: 0,
                usedQuantity: 0,
            };
        }
        receivedMap[data.materialId].usedQuantity += Number(data.quantityUsed) || 0;
    });

    const materialStock = Object.values(receivedMap).map(m => ({
        materialName: m.materialName,
        receivedQuantity: m.receivedQuantity,
        usedQuantity: m.usedQuantity,
        stock: m.receivedQuantity - m.usedQuantity,
    }));

    // ── Use shared financial helper (same logic as getFinancialHistory) ──
    const financials = await _getFinancials(projectNo, project);

    return {
        projectDetails: project,
        materialStock,
        financialSummary: {
            totalSiteExpense: financials.totalExpense,
            advancedPaid: financials.totalAdvance,
            remainingBalance: financials.balance,
        },
    };
};

// ─── Financial History ────────────────────────────────────────────────────────
// Returns full advance + expense history using the shared helper.
exports.getFinancialHistory = async (projectNo) => {
    if (!projectNo) throw new Error("projectNo is required");

    // Fetch project data for the static-advance fallback
    const projectDoc = await projectsCollection.doc(projectNo).get();
    const projectData = projectDoc.exists ? projectDoc.data() : null;

    // ── Use shared financial helper ──
    const financials = await _getFinancials(projectNo, projectData);

    return {
        projectNo,
        summary: {
            totalAdvance: financials.totalAdvance,
            totalExpense: financials.totalExpense,
            balance: financials.balance,
        },
        history: financials.history,
        advances: financials.advances,
        expenses: financials.expenses,
    };
};