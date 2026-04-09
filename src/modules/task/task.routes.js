const router = require("express").Router();
const ctrl = require("./task.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

router.get("/smart/counts",    ctrl.getSmartCounts);
router.get("/smart/today",      ctrl.getToday);
router.get("/smart/scheduled",  ctrl.getScheduled);
router.get("/smart/flagged",    ctrl.getFlagged);
router.get("/smart/completed",  ctrl.getCompleted);
router.get("/list/:listId",     ctrl.getByList);

router.get("/",                ctrl.getAllTasks);
router.post("/",               ctrl.createTask);
router.get("/:id",             ctrl.getTaskById);
router.put("/:id",             ctrl.updateTask);
router.delete("/:id",          ctrl.deleteTask);
router.patch("/:id/completed", ctrl.completeTask);

module.exports = router;