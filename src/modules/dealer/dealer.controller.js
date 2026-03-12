const dealerService = require("./dealer.service");

exports.getDealerHistory = async (req, res, next) => {
    try {
        const result = await dealerService.getDealerHistory(req.params.phoneNumber);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.getAllDealers = async (req, res, next) => {
    try {
        const dealers = await dealerService.getAllDealers();
        res.status(200).json({ success: true, data: dealers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDealerPaymentHistory = async (req, res, next) => {
    try {
        const { phoneNumber } = req.params;
        const result = await dealerService.getDealerPaymentHistory(phoneNumber);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.updateDealerPayment = async (req, res, next) => {
    try {
        const { amountPaid } = req.body;
        const { phoneNumber } = req.params;
        const result = await dealerService.updateDealerPayment(phoneNumber, amountPaid);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
