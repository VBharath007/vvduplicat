const { db } = require("../../config/firebase");

// We'll use projectNo as the document ID for the `projects` collection
// OR we can query by projectNo
const projectsCollection = db.collection("projects");
const worksCollection = db.collection("works");
const materialReceivedCollection = db.collection("materialReceived");
const materialUsedCollection = db.collection("materialUsed");
const siteExpensesCollection = db.collection("siteExpenses");

exports.createProject = async (projectData) => {
    // Generate an automatic projectNo if not provided, or expect it
    // The prompt says "projectNo (business reference ID like PRO001)"
    if (!projectData.projectNo) {
        throw new Error("projectNo is required");
    }

    const docRef = projectsCollection.doc(projectData.projectNo);
    const doc = await docRef.get();
    if (doc.exists) {
        throw new Error("Project with this projectNo already exists");
    }

    // Default timestamp
    projectData.createdAt = new Date().toISOString();

    await docRef.set(projectData);
    return { ...projectData };
};

exports.getAllProjects = async () => {
    const snapshot = await projectsCollection.get();
    const projects = [];
    snapshot.forEach((doc) => {
        projects.push(doc.data());
    });
    return projects;
};

exports.getProjectByNo = async (projectNo) => {
    const docRef = projectsCollection.doc(projectNo);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new Error("Project not found");
    }
    return doc.data();
};

exports.updateProject = async (projectNo, updateData) => {
    const docRef = projectsCollection.doc(projectNo);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new Error("Project not found");
    }

    // Avoid overwriting projectNo and createdAt
    delete updateData.projectNo;
    delete updateData.createdAt;

    await docRef.update(updateData);

    const updatedDoc = await docRef.get();
    return updatedDoc.data();
};

exports.deleteProject = async (projectNo) => {
    const docRef = projectsCollection.doc(projectNo);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new Error("Project not found");
    }
    await docRef.delete();
    return { message: "Project deleted successfully" };
};

exports.getProjectSummary = async (projectNo) => {
    const project = await this.getProjectByNo(projectNo);
    if (!project) {
        throw new Error("Project not found");
    }

    // Materials Received
    const receivedSnap = await materialReceivedCollection.where("projectNo", "==", projectNo).get();
    const receivedMap = {};
    receivedSnap.forEach(doc => {
        const data = doc.data();
        if (!receivedMap[data.materialId]) {
            receivedMap[data.materialId] = { materialName: data.materialName, receivedQuantity: 0, usedQuantity: 0 };
        }
        receivedMap[data.materialId].receivedQuantity += Number(data.quantity) || 0;
    });

    // Materials Used
    const usedSnap = await materialUsedCollection.where("projectNo", "==", projectNo).get();
    usedSnap.forEach(doc => {
        const data = doc.data();
        if (!receivedMap[data.materialId]) {
            receivedMap[data.materialId] = { materialName: data.materialName, receivedQuantity: 0, usedQuantity: 0 };
        }
        receivedMap[data.materialId].usedQuantity += Number(data.quantityUsed) || 0;
    });

    const materialStock = Object.values(receivedMap).map(m => ({
        materialName: m.materialName,
        receivedQuantity: m.receivedQuantity,
        usedQuantity: m.usedQuantity,
        stock: m.receivedQuantity - m.usedQuantity
    }));

    // Financial - Expenses
    const expensesSnap = await siteExpensesCollection.where("projectNo", "==", projectNo).get();
    let totalSiteExpense = 0;
    expensesSnap.forEach(doc => {
        const data = doc.data();
        totalSiteExpense += Number(data.amount) || 0;
    });

    // Financial - Advances
    const advancesCollection = db.collection("advances");
    const advancesSnap = await advancesCollection.where("projectNo", "==", projectNo).get();
    let dynamicAdvancedPaid = 0;
    advancesSnap.forEach(doc => {
        const data = doc.data();
        dynamicAdvancedPaid += Number(data.amountReceived) || 0;
    });

    // Fallback to project static field if dynamic is 0 (just to be safe)
    const staticAdvancedPaid = Number(project.paymentDetails?.advancedPaid) || 0;
    const finalAdvancedPaid = dynamicAdvancedPaid > 0 ? dynamicAdvancedPaid : staticAdvancedPaid;

    const remainingBalance = finalAdvancedPaid - totalSiteExpense;

    return {
        projectDetails: project,
        materialStock: materialStock,
        financialSummary: {
            totalSiteExpense,
            advancedPaid: finalAdvancedPaid,
            remainingBalance
        }
    };
};
