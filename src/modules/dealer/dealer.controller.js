const dealerService = require("./dealer.service");

exports.getDealerHistory = async (req, res, next) => {
    try {
        const result = await dealerService.getDealerHistory(req.params.phoneNumber);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};
