const expenseService = require("./expense.service");

exports.createExpense = async (req, res, next) => {
    try {
        const result = await expenseService.createExpense(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getExpenses = async (req, res, next) => {
    try {
        const { projectNo } = req.query;
        const result = await expenseService.getExpenses(projectNo);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
