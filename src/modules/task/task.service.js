const { db } = require("../../config/firebase");
const { Timestamp } = require("firebase-admin").firestore;

const COLLECTION = "tasks";

// ─── Helpers ────────────────────────────────────────────────────────────────

const toDateString = (date) => date.toISOString().split("T")[0]; // "YYYY-MM-DD"

const todayString = () => toDateString(new Date());

/**
 * Build a Firestore Timestamp from separate date + time strings.
 * dueDate: "YYYY-MM-DD", dueTime: "HH:MM"
 */
const buildDueTimestamp = (dueDate, dueTime) => {
  if (!dueDate) return null;
  const iso = dueTime ? `${dueDate}T${dueTime}:00` : `${dueDate}T00:00:00`;
  return Timestamp.fromDate(new Date(iso));
};

const taskRef = (id) => db.collection(COLLECTION).doc(id);
const tasksCol = () => db.collection(COLLECTION);

// ─── CRUD ────────────────────────────────────────────────────────────────────

const createTask = async (data) => {
  const now = Timestamp.now();
  const payload = {
    title: data.title,
    notes: data.notes || null,
    dueDate: data.dueDate || null,        // "YYYY-MM-DD"
    dueTime: data.dueTime || null,        // "HH:MM"
    dueTimestamp: buildDueTimestamp(data.dueDate, data.dueTime),
    listId: data.listId || "default",
    listName: data.listName || "Reminders",
    flagged: data.flagged ?? false,
    completed: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    userId: data.userId,
  };

  const ref = await tasksCol().add(payload);
  return { id: ref.id, ...payload };
};

const updateTask = async (id, data) => {
  const updates = { ...data, updatedAt: Timestamp.now() };

  // Recompute timestamp if date/time changed
  if (data.dueDate !== undefined || data.dueTime !== undefined) {
    const snap = await taskRef(id).get();
    if (!snap.exists) throw new Error("Task not found");
    const existing = snap.data();
    const newDate = data.dueDate !== undefined ? data.dueDate : existing.dueDate;
    const newTime = data.dueTime !== undefined ? data.dueTime : existing.dueTime;
    updates.dueTimestamp = buildDueTimestamp(newDate, newTime);
  }

  await taskRef(id).update(updates);
  const snap = await taskRef(id).get();
  return { id: snap.id, ...snap.data() };
};

const deleteTask = async (id) => {
  await taskRef(id).delete();
  return { deleted: true };
};

const getTaskById = async (id) => {
  const snap = await taskRef(id).get();
  if (!snap.exists) throw new Error("Task not found");
  return { id: snap.id, ...snap.data() };
};

const completeTask = async (id, completed) => {
  const updates = {
    completed,
    completedAt: completed ? Timestamp.now() : null,
    updatedAt: Timestamp.now(),
  };
  await taskRef(id).update(updates);
  const snap = await taskRef(id).get();
  return { id: snap.id, ...snap.data() };
};

// ─── Smart Lists ─────────────────────────────────────────────────────────────

/** TODAY — tasks due today, not completed */
const getToday = async (userId) => {
  const today = todayString();
  const snap = await tasksCol()
    .where("userId", "==", userId)
    .where("dueDate", "==", today)
    .where("completed", "==", false)
    .orderBy("dueTimestamp")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** SCHEDULED — all tasks with a dueDate, not completed, grouped by date */
const getScheduled = async (userId) => {
  const snap = await tasksCol()
    .where("userId", "==", userId)
    .where("dueDate", "!=", null)
    .where("completed", "==", false)
    .orderBy("dueDate")
    .orderBy("dueTimestamp")
    .get();

  const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Group by dueDate
  const grouped = {};
  for (const task of tasks) {
    const key = task.dueDate;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(task);
  }

  // Build sorted array of { date, label, tasks }
  const today = todayString();
  const tomorrow = toDateString(new Date(Date.now() + 86400000));

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tasks]) => ({
      date,
      label:
        date === today
          ? "Today"
          : date === tomorrow
          ? "Tomorrow"
          : formatDisplayDate(date),
      tasks,
    }));
};

/** ALL — all tasks not completed */
const getAll = async (userId) => {
  const snap = await tasksCol()
    .where("userId", "==", userId)
    .where("completed", "==", false)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** FLAGGED — flagged, not completed */
const getFlagged = async (userId) => {
  const snap = await tasksCol()
    .where("userId", "==", userId)
    .where("flagged", "==", true)
    .where("completed", "==", false)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** COMPLETED — all completed tasks */
const getCompleted = async (userId) => {
  const snap = await tasksCol()
    .where("userId", "==", userId)
    .where("completed", "==", true)
    .orderBy("completedAt", "desc")
    .get();

  const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Group by completion date
  const today = todayString();
  const tomorrow = toDateString(new Date(Date.now() + 86400000));
  const grouped = {};

  for (const task of tasks) {
    const dateKey = task.completedAt
      ? toDateString(task.completedAt.toDate())
      : "Unknown";
    const label =
      dateKey === today
        ? "Today"
        : dateKey === tomorrow
        ? "Tomorrow"
        : formatDisplayDate(dateKey);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(task);
  }

  return grouped;
};

/** SMART LIST COUNTS — for dashboard cards */
const getSmartCounts = async (userId) => {
  const today = todayString();

  const [todaySnap, scheduledSnap, allSnap, flaggedSnap, completedSnap] =
    await Promise.all([
      tasksCol()
        .where("userId", "==", userId)
        .where("dueDate", "==", today)
        .where("completed", "==", false)
        .count()
        .get(),
      tasksCol()
        .where("userId", "==", userId)
        .where("dueDate", "!=", null)
        .where("completed", "==", false)
        .count()
        .get(),
      tasksCol()
        .where("userId", "==", userId)
        .where("completed", "==", false)
        .count()
        .get(),
      tasksCol()
        .where("userId", "==", userId)
        .where("flagged", "==", true)
        .where("completed", "==", false)
        .count()
        .get(),
      tasksCol()
        .where("userId", "==", userId)
        .where("completed", "==", true)
        .count()
        .get(),
    ]);

  return {
    today: todaySnap.data().count,
    scheduled: scheduledSnap.data().count,
    all: allSnap.data().count,
    flagged: flaggedSnap.data().count,
    completed: completedSnap.data().count,
  };
};

/** Tasks by list */
const getByList = async (listId, userId) => {
  const snap = await tasksCol()
    .where("userId", "==", userId)
    .where("listId", "==", listId)
    .where("completed", "==", false)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── Util ────────────────────────────────────────────────────────────────────

const formatDisplayDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
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