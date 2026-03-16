const approvalService = require("./approval.service");
const { db } = require("../../config/firebase");
const approvalsCollection = db.collection("approvals");
const approvalAdvancesCollection = db.collection("approvalAdvances");
const approvalExpensesCollection = db.collection("approvalExpenses");
const workStatusCollection = db.collection("workStatusOptions");


exports.createApproval = async (req, res) => {
    try {
        const result = await approvalService.createApproval(req.body);
        res.status(201).json({ message: "Approval created successfully", data: result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getApprovals = async (req, res) => {
    try {
        const result = await approvalService.getApprovals();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getApprovalById = async (req, res) => {
    try {
        const result = await approvalService.getApprovalById(req.params.id);
        res.status(200).json(result);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

exports.updateApproval = async (req, res) => {
    try {
        const result = await approvalService.updateApproval(req.params.id, req.body);
        res.status(200).json({ message: "Approval updated successfully", data: result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// --- Advances --- //
exports.addAdvance = async (req, res) => {
    try {
        const result = await approvalService.addAdvance(req.params.id, req.body);
        res.status(201).json({ message: "Advance payment(s) recorded successfully", data: result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getAdvances = async (req, res) => {
    try {
        const result = await approvalService.getAdvances(req.params.id);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- Expenses --- //
exports.addExpense = async (req, res) => {
    try {
        const result = await approvalService.addExpense(req.params.id, req.body);
        res.status(201).json({ message: "Expense(s) recorded successfully", data: result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getExpenses = async (req, res) => {
    try {
        const result = await approvalService.getExpenses(req.params.id);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- Status Update --- //
exports.updateStatus = async (req, res) => {
    try {
        const { currentStatus } = req.body;
        if (!currentStatus) throw new Error("currentStatus is required");

        const result = await approvalService.updateStatus(req.params.id, currentStatus);
        res.status(200).json({ message: "Status updated successfully", data: result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};



exports.updateExpense = async (req, res) => {
    try {

        const { expenseId } = req.params;
        const { amount, particularRemark, date } = req.body;

        const docRef = approvalExpensesCollection.doc(expenseId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Expense not found" });
        }

        await docRef.update({
            amount: Number(amount),
            particularRemark: particularRemark || "",
            date: date
        });

        res.json({
            message: "Expense updated successfully"
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.deleteExpense = async (req, res) => {
    try {

        const { expenseId } = req.params;

        const docRef = approvalExpensesCollection.doc(expenseId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Expense not found" });
        }

        await docRef.delete();

        res.json({
            message: "Expense deleted successfully"
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.deleteApproval = async (req, res) => {
    try {

        const { id } = req.params;

        const approvalRef = approvalsCollection.doc(id);
        const approvalDoc = await approvalRef.get();

        if (!approvalDoc.exists) {
            return res.status(404).json({
                message: "Approval not found"
            });
        }

        // 🔹 Delete all advances
        const advancesSnap = await approvalAdvancesCollection
            .where("approvalId", "==", id)
            .get();

        const batch = db.batch();

        advancesSnap.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 🔹 Delete all expenses
        const expensesSnap = await approvalExpensesCollection
            .where("approvalId", "==", id)
            .get();

        expensesSnap.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 🔹 Delete approval document
        batch.delete(approvalRef);

        await batch.commit();

        res.json({
            message: "Approval and related expenses & advances deleted successfully"
        });

    } catch (error) {
        console.error("Delete Approval Error:", error);

        res.status(500).json({
            error: error.message
        });
    }
};

exports.updateAdvance = async (req, res) => {
    try {

        const { advanceId } = req.params;
        const { amountReceived, remark, date } = req.body;

        const docRef = approvalAdvancesCollection.doc(advanceId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Advance not found" });
        }

        const updateData = {};

        if (amountReceived !== undefined) {
            updateData.amountReceived = Number(amountReceived);
        }

        if (remark !== undefined) {
            updateData.remark = remark;
        }

        if (date !== undefined) {
            updateData.date = date;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                message: "No valid fields provided for update"
            });
        }

        await docRef.update(updateData);

        res.json({
            message: "Advance updated successfully"
        });

    } catch (error) {
        console.error("Update Advance Error:", error);
        res.status(500).json({ error: error.message });
    }
};


exports.deleteAdvance = async (req, res) => {
    try {

        const { advanceId } = req.params;

        const docRef = approvalAdvancesCollection.doc(advanceId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Advance not found" });
        }

        await docRef.delete();

        res.json({
            message: "Advance deleted successfully"
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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

        await docRef.update({
            "financialDetails.totalFees": Number(totalFees)
        });

        res.json({
            message: "Total fees updated successfully"
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.addWorkStatus = async (req, res) => {
    try {
        const { name } = req.body;

        const docRef = await workStatusCollection.add({
            name: name.toUpperCase(),
            status: "pending"
        });

        res.json({
            message: "Work status added",
            id: docRef.id
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



exports.confirmWorkStatus = async (req, res) => {
    try {

        const { id } = req.params;

        const docRef = workStatusCollection.doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                message: "Work status not found"
            });
        }

        await docRef.update({
            status: "approved"
        });

        res.json({
            message: "Work status confirmed successfully"
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};


exports.deleteWorkStatus = async (req, res) => {
    try {

        const { id } = req.params;

        const docRef = workStatusCollection.doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                message: "Work status not found"
            });
        }

        await docRef.delete();

        res.json({
            message: "Work status deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};


exports.getWorkStatuses = async (req, res) => {
    try {

        const snap = await workStatusCollection
            .where("status", "==", "approved")
            .get();

        const statuses = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json(statuses);

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};


exports.updateExpense = async (req, res) => {
    try {

        const { expenseId } = req.params;
        const { amount, particularRemark, date } = req.body;

        const docRef = approvalExpensesCollection.doc(expenseId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                message: "Expense not found"
            });
        }

        const updateData = {};

        if (amount !== undefined) {
            updateData.amount = Number(amount);
        }

        if (particularRemark !== undefined) {
            updateData.particularRemark = particularRemark;
        }

        if (date !== undefined) {
            updateData.date = date;
        }

        await docRef.update(updateData);

        res.json({
            message: "Expense updated successfully",
            id: expenseId
        });

    } catch (error) {
        console.error("Update Expense Error:", error);

        res.status(500).json({
            error: error.message
        });
    }
};