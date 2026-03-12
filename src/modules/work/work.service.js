const { db } = require("../../config/firebase");

const worksCollection = db.collection("works");

/**
 * Upsert rule:
 * - workId provided          → direct update by ID (edit flow, never creates).
 * - No workId, same workName → upsert: ONE doc per (projectNo + date + workName).
 * - No workId, new workName  → create NEW doc (allows multiple works per day).
 *
 * This lets the user have "ceiling work" and "basement work" on the same day
 * as separate, independent Firestore documents.
 */
exports.createWork = async (workData) => {
    if (!workData.projectNo) {
        throw new Error("projectNo is required");
    }

    const workDate = workData.date || new Date().toISOString().split("T")[0];
    workData.date = workDate;

    // Normalize and ensure both 'work' and 'workName' exist for the Frontend
    const name = (workData.work || workData.workName || "General Work").trim();
    workData.work = name;
    workData.workName = name;

    // --- EDIT FLOW: workId supplied → direct overwrite ---
    if (workData.workId) {
        const docRef = worksCollection.doc(workData.workId);
        const doc = await docRef.get();
        if (!doc.exists) throw new Error(`Work log '${workData.workId}' not found`);

        const updatePayload = { ...workData };
        delete updatePayload.workId;
        delete updatePayload.createdAt;
        updatePayload.updatedAt = new Date().toISOString();
        if (updatePayload.labour != null) updatePayload.labour = String(updatePayload.labour);

        await docRef.update(updatePayload);
        const updated = await docRef.get();
        return { workId: updated.id, ...updated.data() };
    }

    // --- UPSERT FLOW ---
    const existingSnapshot = await worksCollection
        .where("projectNo", "==", workData.projectNo)
        .where("date", "==", workDate)
        .where("work", "==", name)
        .limit(1)
        .get();

    if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];
        const updatePayload = { ...workData };
        delete updatePayload.createdAt;
        updatePayload.updatedAt = new Date().toISOString();
        if (updatePayload.labour != null) updatePayload.labour = String(updatePayload.labour);

        await existingDoc.ref.update(updatePayload);
        const updated = await existingDoc.ref.get();
        return { workId: updated.id, ...updated.data() };
    }

    // Truly new entry
    workData.createdAt = new Date().toISOString();
    if (workData.labour != null) workData.labour = String(workData.labour);

    const docRef = await worksCollection.add(workData);
    return { workId: docRef.id, ...workData };
};

exports.getWorks = async (projectNo) => {
    let query = worksCollection;
    if (projectNo) {
        query = query.where("projectNo", "==", projectNo);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ workId: doc.id, ...doc.data() }));
};

exports.getWorkById = async (workId) => {
    const doc = await worksCollection.doc(workId).get();
    if (!doc.exists) {
        throw new Error("Work log not found");
    }
    return { workId: doc.id, ...doc.data() };
};

exports.updateWork = async (workId, updateData) => {
    const docRef = worksCollection.doc(workId);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new Error("Work log not found");
    }

    delete updateData.workId;
    delete updateData.createdAt;
    updateData.updatedAt = new Date().toISOString();

    if (updateData.labour != null) {
        updateData.labour = String(updateData.labour);
    }

    await docRef.update(updateData);
    const updated = await docRef.get();
    return { workId: updated.id, ...updated.data() };
};

exports.deleteWork = async (workId) => {
    const docRef = worksCollection.doc(workId);
    if (!(await docRef.get()).exists) {
        throw new Error("Work log not found");
    }
    await docRef.delete();
    return { message: "Work log deleted successfully" };
};

/**
 * Get work documents for a specific project + date.
 * Returns all works for that date (there can be multiple if different names).
 */
exports.getWorkByDate = async (projectNo, date) => {
    const snapshot = await worksCollection
        .where("projectNo", "==", projectNo)
        .where("date", "==", date)
        .get();

    if (snapshot.empty) return null;
    const docs = snapshot.docs.map(doc => ({ workId: doc.id, ...doc.data() }));
    return docs.length === 1 ? docs[0] : docs;
};