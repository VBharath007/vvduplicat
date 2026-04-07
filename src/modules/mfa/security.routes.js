const express = require("express");
const router = express.Router();
const mfaController = require("./mfa.controller");

// POST /api/mfa/verify
router.post("/verify", mfaController.verifyMfa);

module.exports = router;