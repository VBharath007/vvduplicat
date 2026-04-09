const taskService = require("./task.service");

// Pulls userId from auth middleware (assumes req.user is set)
const uid = (req) => req.user?.uid || req.headers["x-user-id"];

const createTask = async (req, res, next) => {
  try {
    const task = await taskService.createTask({ ...req.body, userId: uid(req) });
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.body);
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    await taskService.deleteTask(req.params.id);
    res.json({ success: true, message: "Task deleted" });
  } catch (err) {
    next(err);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
};

const completeTask = async (req, res, next) => {
  try {
    const completed = req.body.completed ?? true;
    const task = await taskService.completeTask(req.params.id, completed);
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
};

// ─── Smart Lists ─────────────────────────────────────────────────────────────

const getToday = async (req, res, next) => {
  try {
    const tasks = await taskService.getToday(uid(req));
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    next(err);
  }
};

const getScheduled = async (req, res, next) => {
  try {
    const grouped = await taskService.getScheduled(uid(req));
    res.json({ success: true, data: grouped });
  } catch (err) {
    next(err);
  }
};

const getAll = async (req, res, next) => {
  try {
    const tasks = await taskService.getAll(uid(req));
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    next(err);
  }
};

const getFlagged = async (req, res, next) => {
  try {
    const tasks = await taskService.getFlagged(uid(req));
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    next(err);
  }
};

const getCompleted = async (req, res, next) => {
  try {
    const grouped = await taskService.getCompleted(uid(req));
    res.json({ success: true, data: grouped });
  } catch (err) {
    next(err);
  }
};

const getSmartCounts = async (req, res, next) => {
  try {
    const counts = await taskService.getSmartCounts(uid(req));
    res.json({ success: true, data: counts });
  } catch (err) {
    next(err);
  }
};

const getByList = async (req, res, next) => {
  try {
    const tasks = await taskService.getByList(req.params.listId, uid(req));
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTask,
  updateTask,
  deleteTask,
  getTaskById,
  completeTask,
  getToday,
  getScheduled,
  getAll,
  getFlagged,
  getCompleted,
  getSmartCounts,
  getByList,
};