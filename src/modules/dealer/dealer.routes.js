const express = require("express");
const router = express.Router();
const dealerController = require("./dealer.controller");

router.get("/:phoneNumber", dealerController.getDealerHistory);

module.exports = router;
