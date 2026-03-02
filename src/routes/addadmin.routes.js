const express = require("express");
const router = express.Router();
const addadminController = require("../controllers/addadmin.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");



// 🔓 Public Routes (login flow — must stay public)
router.post("/login", addadminController.loginAdmin);
router.post("/mfa-setup", addadminController.setupMfa);
router.post("/mfa", addadminController.verifyMfa);

// 🔒 Protected Routes (admin only)
router.post("/register", verifyToken, authorize(["admin"]), addadminController.registerAdmin);
router.post("/add", verifyToken, addadminController.addAdmin);
router.get("/", verifyToken, authorize(["admin"]), addadminController.getAdmins);
router.put("/:empID", verifyToken, authorize(["admin"]), addadminController.updateAdmin);
router.delete("/:empID", verifyToken, authorize(["admin"]), addadminController.deleteAdmin);
router.get("/profile", verifyToken, addadminController.getAdminProfile);




module.exports = router;