const { db } = require("../../config/firebase");

const COLLECTION = "tasks";
const tasksCol = () => db.collection(COLLECTION);
const taskRef = (id) => db.collection(COLLECTION).doc(id);

const toDateString = (date) => date.toISOString().split("T")[0];
const todayString = () => toDateString(new Date());

const buildDueTimestamp = (dueDate, dueTime) => {
  if (!dueDate) return null;
  return dueTime ? `${dueDate}T${dueTime}:00` : `${dueDate}T00:00:00`;
};

const formatDisplayDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

const createTask = async (data) => {
  const now = new Date().toISOString();
  const payload = {
    title: data.title,
    notes: data.notes || null,
    dueDate: data.dueDate || null,
    dueTime: data.dueTime || null,
    dueTimestamp: buildDueTimestamp(data.dueDate, data.dueTime),
    hasDueDate: !!data.dueDate,           // ✅ boolean flag — fast filtering
    listId: data.listId || "default",
    listName: data.listName || "Reminders",
    flagged: data.flagged ?? false,
    completed: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await tasksCol().add(payload);
  return { id: ref.id, ...payload };
};

const updateTask = async (id, data) => {
  const now = new Date().toISOString();
  const snap = await taskRef(id).get();
  if (!snap.exists) throw new Error("Task not found");
  const existing = snap.data();

  const updates = { ...data, updatedAt: now };
  if (data.dueDate !== undefined || data.dueTime !== undefined) {
    const newDate = data.dueDate !== undefined ? data.dueDate : existing.dueDate;
    const newTime = data.dueTime !== undefined ? data.dueTime : existing.dueTime;
    updates.dueTimestamp = buildDueTimestamp(newDate, newTime);
    updates.hasDueDate = !!newDate;
  }

  await taskRef(id).update(updates);
  const updated = await taskRef(id).get();
  return { id: updated.id, ...updated.data() };
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
  const now = new Date().toISOString();
  await taskRef(id).update({
    completed,
    completedAt: completed ? now : null,
    updatedAt: now,
  });
  const snap = await taskRef(id).get();
  return { id: snap.id, ...snap.data() };
};

// ── Smart Lists (single query + JS filter/sort) ───────────────────────────────

// fetch all incomplete once — reuse across functions
const fetchAllIncomplete = async () => {
  const snap = await tasksCol().where("completed", "==", false).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

const getAll = async () => {
  const tasks = await fetchAllIncomplete();
  return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const getToday = async () => {
  const today = todayString();
  const tasks = await fetchAllIncomplete();
  return tasks
    .filter((t) => t.dueDate === today)
    .sort((a, b) => (a.dueTimestamp || "").localeCompare(b.dueTimestamp || ""));
};

const getScheduled = async () => {
  const tasks = await fetchAllIncomplete();
  const withDate = tasks.filter((t) => t.hasDueDate && t.dueDate);

  withDate.sort((a, b) => {
    const d = a.dueDate.localeCompare(b.dueDate);
    if (d !== 0) return d;
    return (a.dueTimestamp || "").localeCompare(b.dueTimestamp || "");
  });

  const today = todayString();
  const tomorrow = toDateString(new Date(Date.now() + 86400000));
  const grouped = {};

  for (const task of withDate) {
    const key = task.dueDate;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(task);
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tasks]) => ({
      date,
      label: date === today ? "Today" : date === tomorrow ? "Tomorrow" : formatDisplayDate(date),
      tasks,
    }));
};

const getFlagged = async () => {
  const tasks = await fetchAllIncomplete();
  return tasks.filter((t) => t.flagged);
};

const getCompleted = async () => {
  const snap = await tasksCol().where("completed", "==", true).get();
  const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  tasks.sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));

  const today = todayString();
  const tomorrow = toDateString(new Date(Date.now() + 86400000));
  const grouped = {};

  for (const task of tasks) {
    const dateKey = task.completedAt ? task.completedAt.split("T")[0] : "Unknown";
    const label = dateKey === today ? "Today" : dateKey === tomorrow ? "Tomorrow" : formatDisplayDate(dateKey);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(task);
  }
  return grouped;
};

const getByList = async (listId) => {
  const tasks = await fetchAllIncomplete();
  return tasks.filter((t) => t.listId === listId);
};

// ── Smart Counts (2 queries only) ────────────────────────────────────────────
const getSmartCounts = async () => {
  const today = todayString();

  const [incompleteSnap, completedSnap] = await Promise.all([
    tasksCol().where("completed", "==", false).get(),
    tasksCol().where("completed", "==", true).count().get(),
  ]);

  const incomplete = incompleteSnap.docs.map((d) => d.data());

  return {
    today:     incomplete.filter((t) => t.dueDate === today).length,
    scheduled: incomplete.filter((t) => t.hasDueDate).length,
    all:       incomplete.length,
    flagged:   incomplete.filter((t) => t.flagged).length,
    completed: completedSnap.data().count,
  };
};

module.exports = {
  createTask, updateTask, deleteTask, getTaskById, completeTask,
  getAll, getToday, getScheduled, getFlagged, getCompleted, getByList, getSmartCounts,
};