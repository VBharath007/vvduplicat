const express = require("express");
const router = express.Router();
const addadminController = require("../controllers/addadmin.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");



// 🔓 Public Routes
router.post("/register", addadminController.registerAdmin);
router.post("/login", addadminController.loginAdmin);
router.post("/mfa-setup", addadminController.setupMfa);
router.post("/mfa", addadminController.verifyMfa);

// 🔒 Protected Routes
router.post("/add", verifyToken, addadminController.addAdmin);
router.get("/", verifyToken, addadminController.getAdmins);
router.put("/:empID", verifyToken, addadminController.updateAdmin);
router.delete("/:empID", verifyToken, addadminController.deleteAdmin);
router.get("/profile", verifyToken, addadminController.getAdminProfile);



module.exports = router;