const projectService = require("./project.service");
const { db } = require("../../config/firebase");

exports.createProject = async (req, res, next) => {
    try {
        const result = await projectService.createProject(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getAllProjects = async (req, res, next) => {
    try {
        const result = await projectService.getAllProjects();
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProjectByNo = async (req, res, next) => {
    try {
        const result = await projectService.getProjectByNo(req.params.projectNo);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.updateProject = async (req, res, next) => {
    try {
        const result = await projectService.updateProject(req.params.projectNo, req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteProject = async (req, res, next) => {
    try {
        const result = await projectService.deleteProject(req.params.projectNo);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getProjectSummary = async (req, res, next) => {
    try {
        const result = await projectService.getProjectSummary(req.params.projectNo);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};



exports.getWorkHistory = async (req, res) => {
    try {
        const { projectNo } = req.params;

        // 1️⃣ Fetch data
        const projectRef = db.collection("projects").where("projectNo", "==", projectNo);
        const worksRef = db.collection("works").where("projectNo", "==", projectNo);
        const receivedRef = db.collection("materialReceived").where("projectNo", "==", projectNo);
        const usedRef = db.collection("materialUsed").where("projectNo", "==", projectNo);
        const advanceRef = db.collection("advances").where("projectNo", "==", projectNo);
        const expenseRef = db.collection("siteExpenses").where("projectNo", "==", projectNo);
        // User's addMaterialRequired uses the "materialRequired" collection for storing the plans/requirements
        const requiredRef = db.collection("materialRequired").where("projectNo", "==", projectNo);

        const [
            projectSnap,
            worksSnap,
            receivedSnap,
            usedSnap,
            advanceSnap,
            expenseSnap,
            requiredSnap
        ] = await Promise.all([
            projectRef.get(),
            worksRef.get(),
            receivedRef.get(),
            usedRef.get(),
            advanceRef.get(),
            expenseRef.get(),
            requiredRef.get()
        ]);

        // 2️⃣ Convert to array
        const project = projectSnap.docs[0]?.data();
        const works = worksSnap.docs.map(doc => doc.data());
        const received = receivedSnap.docs.map(doc => doc.data());
        const used = usedSnap.docs.map(doc => doc.data());
        const advances = advanceSnap.docs.map(doc => doc.data());
        const expenses = expenseSnap.docs.map(doc => doc.data());
        const requiredPlans = requiredSnap.docs.map(doc => doc.data());

        // 3️⃣ STOCK LOGIC
        const stockMap = {};

        received.forEach(item => {
            if (!stockMap[item.materialId]) {
                stockMap[item.materialId] = {
                    materialId: item.materialId,
                    materialName: item.materialName,
                    received: 0,
                    used: 0
                };
            }
            stockMap[item.materialId].received += Number(item.quantity) || 0;
        });

        used.forEach(item => {
            if (!stockMap[item.materialId]) {
                stockMap[item.materialId] = {
                    materialId: item.materialId,
                    materialName: item.materialName,
                    received: 0,
                    used: 0
                };
            }

            stockMap[item.materialId].used += item.quantityUsed;
        });

        const stock = Object.values(stockMap).map(item => ({
            ...item,
            stock: item.received - item.used
        }));


        // 4️⃣ MATERIAL REQUIRED
        const materialRequired = requiredPlans.map(plan => {

            const stockItem = stock.find(
                s => s.materialId === plan.materialId
            );

            const currentStock = stockItem ? stockItem.stock : 0;
            // The required requirement value might be saved as requiredQuantity from the POST body
            const plannedQty = Number(plan.plannedQuantity || plan.requiredQuantity) || 0;
            const requiredQty = plannedQty - currentStock;

            return {
                materialId: plan.materialId,
                materialName: plan.materialName,
                plannedQuantity: plannedQty,
                stock: currentStock,
                materialRequired: requiredQty > 0 ? requiredQty : 0
            };

        });


        // 5️⃣ Remaining Balance
        const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
        const remainingBalance = 500000 - totalExpense;


        // 6️⃣ Response
        res.json({
            projectNo,
            workHistory: works,
            materialReceived: received,
            materialUsed: used,
            stock,
            materialRequired,   // ✅ Added
            advanceReceivedHistory: advances,
            siteExpenseHistory: expenses,
            remainingBalance
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
