const express = require("express");
const router = express.Router();
const dealerController = require("./dealer.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

const isAdmin = [verifyToken, authorize(["admin"])];

router.get("/", isAdmin, dealerController.getAllDealers);
router.get("/:phoneNumber", isAdmin, dealerController.getDealerHistory);
router.put("/:phoneNumber/payment", isAdmin, dealerController.updateDealerPayment);

module.exports = router;
