const router = require("express").Router();
const ctrl = require("./task.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

// ─── Smart Lists (must be above /:id to avoid route conflict) ────────────────
router.get("/smart/counts",    verifyToken, authorize , ctrl.getSmartCounts);
router.get("/smart/today",     verifyToken, authorize , ctrl.getToday);
router.get("/smart/scheduled", verifyToken, authorize , ctrl.getScheduled);
router.get("/smart/all",       verifyToken, authorize , ctrl.getAll);
router.get("/smart/flagged",   verifyToken, authorize , ctrl.getFlagged);
router.get("/smart/completed", verifyToken, authorize , ctrl.getCompleted);

// ─── List-scoped tasks ───────────────────────────────────────────────────────
router.get("/list/:listId",    verifyToken, authorize , ctrl.getByList);

// ─── CRUD ────────────────────────────────────────────────────────────────────
router.post("/",               verifyToken, authorize , ctrl.createTask);
router.get("/:id",             verifyToken, authorize , ctrl.getTaskById);
router.put("/:id",             verifyToken, authorize , ctrl.updateTask);
router.delete("/:id",          verifyToken, authorize , ctrl.deleteTask);
router.patch("/:id/complete",  verifyToken, authorize , ctrl.completeTask);

module.exports = router;