const router = require("express").Router();
const salaryController = require("../controllers/salary.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");

router.post("/manual", verifyToken, authorize(["admin"]), salaryController.createSalary);
router.put("/:id", verifyToken, authorize(["admin"]), salaryController.updateSalary);
router.delete("/:id", verifyToken, authorize(["admin"]), salaryController.deleteSalary);
router.get("/salary/:empID", verifyToken, authorize(["employee", "admin"]), salaryController.getSalaryByEmpID);

// ── ADVANCE SALARY ROUTES ──────────────────────────────────────
// ➕ Give advance to employee
router.post("/advance/give", verifyToken, authorize(["admin"]), salaryController.giveAdvanceSalary);

// 📖 Get advance history (filter by ?month=3&year=2026)
router.get("/advance/history/:empID", verifyToken, authorize(["admin", "employee"]), salaryController.getAdvanceHistory);

// 💰 Settle final salary on payday  (monthlySalary - totalAdvance = finalPay)
router.post("/advance/settle", verifyToken, authorize(["admin"]), salaryController.settleFinalSalary);

module.exports = router;
