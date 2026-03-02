const { db } = require('../config/firebase');

// ➕ 1. CREATE PROJECT (With Auto-Generated Project Code)
exports.createProject = async (data) => {
    // 🚫 Unique Project Name Check (case-insensitive)
    const nameToCheck = data.projectName?.trim().toLowerCase();
    if (!nameToCheck) throw Object.assign(new Error("Project name is required."), { code: "INVALID_NAME" });

    const existingSnap = await db.collection('projects')
        .where('projectNameLower', '==', nameToCheck)
        .limit(1)
        .get();

    if (!existingSnap.empty) {
        throw Object.assign(
            new Error(`Project name "${data.projectName}" already exists. Please use a unique project name.`),
            { code: "DUPLICATE_NAME" }
        );
    }

    // Basic Financial Calculations
    const totalBudget = parseFloat(data.financials?.budget?.totalProjectBudget || 0);
    const estimatedCost = parseFloat(data.financials?.budget?.estimatedProjectCost || 0);
    const totalReceived = parseFloat(data.financials?.clientPayments?.totalAmountReceived || 0);
    const totalSpent = parseFloat(data.financials?.expenses?.totalSpentAmount || 0);

    // ✨ Auto-generating a Short Project Code (Ex: MOD-4829) for easy reference
    const shortCode = `${data.projectName.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const projectData = {
        projectCode: data.projectCode || shortCode,
        projectName: data.projectName,
        projectNameLower: nameToCheck,   // 🔑 Used for unique-name Firestore query
        tagline: data.tagline || "Building a Future-Ready Corporate Space",
        priority: data.priority || "Medium",
        status: data.status || "In Progress",
        progressPercentage: parseInt(data.progressPercentage || 0),
        riskLevel: data.riskLevel || "Low",

        // Financials Section (Calculated)
        financials: {
            budget: {
                totalProjectBudget: totalBudget,
                estimatedProjectCost: estimatedCost,
                budgetUtilizationRate: totalBudget > 0 ? `${Math.round((estimatedCost / totalBudget) * 100)}%` : "0%"
            },
            expenses: {
                totalSpentAmount: totalSpent,
                remainingBudget: totalBudget - totalSpent,
                majorExpenseCategories: data.financials?.expenses?.majorExpenseCategories || []
            },
            clientPayments: {
                totalAmountReceived: totalReceived,
                remainingAmountToReceive: totalBudget - totalReceived,
                paymentStatus: data.financials?.clientPayments?.paymentStatus || "Pending",
                nextPayment: {
                    dueDate: data.financials?.clientPayments?.nextPayment?.dueDate || null,
                    amount: parseFloat(data.financials?.clientPayments?.nextPayment?.amount || 0),
                    reminderStatus: data.financials?.clientPayments?.nextPayment?.reminderStatus || "Scheduled"
                }
            },
            profit: {
                expectedProfit: totalBudget - estimatedCost,
                currentProfit: totalReceived - totalSpent
            }
        },

        // Construction & Client Details (As per your structure)
        constructionDetails: {
            totalUnits: parseInt(data.constructionDetails?.totalUnits || 0),
            totalFloors: parseInt(data.constructionDetails?.totalFloors || 0),
            builtUpAreaSqft: parseFloat(data.constructionDetails?.builtUpAreaSqft || 0),
            approvalStatus: data.constructionDetails?.approvalStatus || "Pending",
            labourCount: parseInt(data.constructionDetails?.labourCount || 0),
            constructionTheme: data.constructionDetails?.constructionTheme || "Modern Minimalist Corporate Office",
            materialsPlanned: data.constructionDetails?.materialsPlanned || []
        },

        projectManager: data.projectManager || {},
        siteEngineer: data.siteEngineer || {},

        clientDetails: {
            clientName: data.clientDetails?.clientName || "",
            clientContact: data.clientDetails?.clientContact || "",
            clientEmail: data.clientDetails?.clientEmail || "",
            clientAddress: data.clientDetails?.clientAddress || "",
            clientType: data.clientDetails?.clientType || "Individual",
            clientVision: data.clientDetails?.clientVision || ""
        },

        location: {
            city: data.location?.city || "",
            area: data.location?.area || "",
            state: data.location?.state || "Tamil Nadu",
            country: data.location?.country || "India",
            latitude: parseFloat(data.location?.latitude || 0),
            longitude: parseFloat(data.location?.longitude || 0),
            siteAccessibility: data.location?.siteAccessibility || ""
        },

        startDate: data.startDate,
        endDate: data.endDate,
        milestones: data.timeline?.milestones || [],

        branding: data.branding || {
            projectColorTheme: "Blue & Grey",
            presentationStyle: "Minimalistic + Data-Centric"
        },

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastUpdatedBy: data.lastUpdatedBy || "System"
    };

    const docRef = await db.collection('projects').add(projectData);
    return { id: docRef.id, ...projectData };
};

// 📖 2. GET ALL PROJECTS (Updated for Owner's Clarity)
exports.getAllProjects = async () => {
    const snapshot = await db.collection('projects').orderBy('createdAt', 'desc').get();

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            // ✨ Frontend-la owner "Modern Villa (Madurai - Ramesh)" nu paapaaru
            displayName: `${data.projectName} (${data.location?.city || 'N/A'} - ${data.clientDetails?.clientName || 'N/A'})`,
            ...data
        };
    });
};

// 🔍 3. GET SINGLE PROJECT
exports.getProjectById = async (id) => {
    const doc = await db.collection('projects').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
};

// 📝 4. UPDATE PROJECT (PATCH)
exports.updateProject = async (id, updateData) => {
    const docRef = db.collection('projects').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Project not found!");

    const updatedPayload = {
        ...updateData,
        updatedAt: new Date().toISOString()
    };

    await docRef.update(updatedPayload);
    return { id, ...updatedPayload };
};

// 🗑️ 5. DELETE PROJECT
exports.deleteProject = async (id) => {
    await db.collection('projects').doc(id).delete();
    return { message: "Project deleted successfully", id };
};