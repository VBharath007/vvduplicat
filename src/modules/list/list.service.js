const { db } = require("../../config/firebase");
const { Timestamp } = require("firebase-admin").firestore;

const COLLECTION = "lists";

const listRef  = (id) => db.collection(COLLECTION).doc(id);
const listsCol = ()   => db.collection(COLLECTION);

const getLists = async (userId) => {
  const snap = await listsCol()
    .where("userId", "==", userId)
    .orderBy("createdAt", "asc")
    .get();

  // For each list, get live task count
  const lists = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const withCounts = await Promise.all(
    lists.map(async (list) => {
      const countSnap = await db
        .collection("tasks")
        .where("listId", "==", list.id)
        .where("completed", "==", false)
        .count()
        .get();
      return { ...list, taskCount: countSnap.data().count };
    })
  );

  return withCounts;
};

const createList = async (data) => {
  const now = Timestamp.now();
  const payload = {
    name: data.name,
    color: data.color || "#007AFF",   // iOS blue default
    icon: data.icon || "list",
    createdAt: now,
    updatedAt: now,
    userId: data.userId,
  };
  const ref = await listsCol().add(payload);
  return { id: ref.id, ...payload, taskCount: 0 };
};

const updateList = async (id, data) => {
  const updates = { ...data, updatedAt: Timestamp.now() };
  delete updates.userId; // prevent userId tampering
  await listRef(id).update(updates);
  const snap = await listRef(id).get();
  return { id: snap.id, ...snap.data() };
};

const deleteList = async (id, userId) => {
  // Optionally, reassign tasks to "default" list
  const taskSnap = await db
    .collection("tasks")
    .where("listId", "==", id)
    .where("userId", "==", userId)
    .get();

  const batch = db.batch();
  taskSnap.docs.forEach((doc) => {
    batch.update(doc.ref, { listId: "default", listName: "Reminders" });
  });
  batch.delete(listRef(id));
  await batch.commit();

  return { deleted: true, tasksReassigned: taskSnap.size };
};

module.exports = { getLists, createList, updateList, deleteList };