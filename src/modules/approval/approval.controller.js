const approvalService = require("./approval.service");

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
