const express = require("express");
const router = express.Router();  // 🔹 You must create the router

const { verifyToken } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");
const adminController = require("../controllers/admin.controller");
const employeeController = require("../controllers/employee.controller");
const salaryController = require("../controllers/salary.controller");



// Employees
router.get("/employees", verifyToken, authorize(['admin']), adminController.getAllEmployees);
router.get("/employee/:empID", verifyToken, authorize(['admin']), adminController.getEmployeeDetail);




module.exports = router;
