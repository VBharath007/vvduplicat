const bankService = require("./bank.service");

// ─────────────────────────────────────────────
// 📊 GET ALL BANKS + DASHBOARD SUMMARY
// ─────────────────────────────────────────────
exports.getAllBanks = async (req, res) => {
  try {
    const result = await bankService.getAllBanksWithSummary();

    res.status(200).json({
      success: true,
      data: result.banks,
      summary: result.summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// 🏦 GET SINGLE BANK
// ─────────────────────────────────────────────
exports.getBankById = async (req, res) => {
  try {
    const result = await bankService.getBankById(req.params.bankId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

// ─────────────────────────────────────────────
// 📜 GET BANK TRANSACTIONS
// ─────────────────────────────────────────────
exports.getBankTransactions = async (req, res) => {
  try {
    const result = await bankService.getBankTransactions(req.params.bankId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.createBank = async (req, res) => {
  try {
    const data = req.body;

    const result = await bankService.createBank(data);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};