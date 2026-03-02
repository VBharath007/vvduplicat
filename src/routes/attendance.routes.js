const router = require("express").Router();
const controller = require("../controllers/attendance.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");


router.post("/:empID", verifyToken, controller.markAttendance);
router.get("/:empID/:month", verifyToken, authorize(["employee", "admin"]), controller.getAttendanceByMonth);

module.exports = router;
