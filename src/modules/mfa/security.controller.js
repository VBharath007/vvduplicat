const mfaService = require("./security.service");

exports.verifyMfa = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Code is required",
      });
    }

    const result = await mfaService.verifyMfaCode(code);

    return res.status(result.success ? 200 : 401).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};