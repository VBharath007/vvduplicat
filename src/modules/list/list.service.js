const { db } = require("../../config/firebase");

const COLLECTION = "lists";
const listsCol = () => db.collection(COLLECTION);
const listRef  = (id) => db.collection(COLLECTION).doc(id);

const getLists = async () => {
  const [listsSnap, tasksSnap] = await Promise.all([
    listsCol().get(),
    db.collection("tasks").where("completed", "==", false).get(),
  ]);

  // Count tasks per listId in JS — no extra queries
  const countMap = {};
  tasksSnap.docs.forEach((d) => {
    const lid = d.data().listId || "default";
    countMap[lid] = (countMap[lid] || 0) + 1;
  });

  return listsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    taskCount: countMap[d.id] || 0,
  }));
};

const createList = async (data) => {
  const now = new Date().toISOString();
  const payload = {
    name: data.name,
    color: data.color || "#007AFF",
    icon: data.icon || "list",
    createdAt: now,
    updatedAt: now,
  };
  const ref = await listsCol().add(payload);
  return { id: ref.id, ...payload, taskCount: 0 };
};

const updateList = async (id, data) => {
  const updates = { ...data, updatedAt: new Date().toISOString() };
  delete updates.userId;
  await listRef(id).update(updates);
  const snap = await listRef(id).get();
  return { id: snap.id, ...snap.data() };
};

const deleteList = async (id) => {
  const taskSnap = await db.collection("tasks").where("listId", "==", id).get();
  const batch = db.batch();
  taskSnap.docs.forEach((doc) => {
    batch.update(doc.ref, { listId: "default", listName: "Reminders" });
  });
  batch.delete(listRef(id));
  await batch.commit();
  return { deleted: true, tasksReassigned: taskSnap.size };
};

module.exports = { getLists, createList, updateList, deleteList };