const salaryTxnService = require('../services/salaryTransaction.service');

// ═══════════════════════════════════════════════════════════
// GET /salary-transactions/summary/:empID
// ═══════════════════════════════════════════════════════════
exports.getSalarySummary = async (req, res) => {
    try {
        const { empID } = req.params;
        const { month, year } = req.query;   // ?month=3&year=2026
        const data = await salaryTxnService.getSalarySummary(empID, month, year);
        res.status(200).json({ success: true, data });
    } catch (e) {
        if (e.code === 'EMP_NOT_FOUND') return res.status(404).json({ success: false, message: e.message });
        console.error('getSalarySummary error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
};


// ═══════════════════════════════════════════════════════════
// POST /salary-transactions/advance/:empID
// Body: { amount, remark }
// ═══════════════════════════════════════════════════════════
exports.addAdvance = async (req, res) => {
    try {
        const { empID } = req.params;
        const { amount, remark, month, year } = req.body;   // month/year optional

        if (!amount) {
            return res.status(400).json({ success: false, message: 'amount is required.' });
        }

        const result = await salaryTxnService.addAdvance(empID, amount, remark, month, year);
        res.status(201).json({
            success: true,
            message: `Advance of ₹${amount} recorded. New balance: ₹${result.newBalance}`,
            data: result
        });
    } catch (e) {
        if (e.code === 'EMP_NOT_FOUND') return res.status(404).json({ success: false, message: e.message });
        if (e.code === 'INVALID_AMOUNT') return res.status(400).json({ success: false, message: e.message });
        if (e.code === 'EXCEEDS_BALANCE') return res.status(400).json({ success: false, message: e.message });
        console.error('addAdvance error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
};


// ═══════════════════════════════════════════════════════════
// POST /salary-transactions/payment/:empID
// Body: { amount, remark }
// ═══════════════════════════════════════════════════════════
exports.addPayment = async (req, res) => {
    try {
        const { empID } = req.params;
        const { amount, remark, month, year } = req.body;   // month/year optional

        if (!amount) {
            return res.status(400).json({ success: false, message: 'amount is required.' });
        }

        const result = await salaryTxnService.addPayment(empID, amount, remark, month, year);
        res.status(201).json({
            success: true,
            message: result.message,
            data: result
        });
    } catch (e) {
        if (e.code === 'EMP_NOT_FOUND') return res.status(404).json({ success: false, message: e.message });
        if (e.code === 'INVALID_AMOUNT') return res.status(400).json({ success: false, message: e.message });
        if (e.code === 'AMOUNT_MISMATCH') return res.status(400).json({ success: false, message: e.message });
        console.error('addPayment error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
};
