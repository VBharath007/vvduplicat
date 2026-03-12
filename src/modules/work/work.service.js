const { db } = require("../../config/firebase");

const worksCollection = db.collection("works");

/**
 * Upsert rule: ONE document per (projectNo + date).
 * - If workId is provided → direct update by ID (edit flow).
 * - If no workId → find by projectNo+date; update if exists, create if not.
 */
exports.createWork = async (workData) => {
    if (!workData.projectNo) {
        throw new Error("projectNo is required");
    }

    const workDate = workData.date || new Date().toISOString().split("T")[0];
    workData.date = workDate;

    // --- EDIT FLOW: workId supplied → direct overwrite, never create new ---
    if (workData.workId) {
        const docRef = worksCollection.doc(workData.workId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw new Error(`Work log '${workData.workId}' not found`);
        }

        const updatePayload = { ...workData };
        delete updatePayload.workId;    // not a Firestore field
        delete updatePayload.createdAt; // preserve original
        updatePayload.updatedAt = new Date().toISOString();

        if (updatePayload.labour != null) {
            updatePayload.labour = String(updatePayload.labour);
        }

        await docRef.update(updatePayload);
        const updated = await docRef.get();
        return { workId: updated.id, ...updated.data() };
    }

    // --- CREATE / UPSERT FLOW: match strictly by projectNo + date only ---
    const existingSnapshot = await worksCollection
        .where("projectNo", "==", workData.projectNo)
        .where("date", "==", workDate)
        .limit(1)
        .get();

    if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];

        const updatePayload = { ...workData };
        delete updatePayload.createdAt;
        updatePayload.updatedAt = new Date().toISOString();

        if (updatePayload.labour != null) {
            updatePayload.labour = String(updatePayload.labour);
        }

        await existingDoc.ref.update(updatePayload);
        const updated = await existingDoc.ref.get();
        return { workId: updated.id, ...updated.data() };
    }

    // Truly new entry for this date
    workData.createdAt = new Date().toISOString();

    if (workData.labour != null) {
        workData.labour = String(workData.labour);
    }

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

    // Protect immutable fields
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
 * Get the single work document for a specific project + date.
 * Used by frontend to check if today's log already exists.
 */
exports.getWorkByDate = async (projectNo, date) => {
    const snapshot = await worksCollection
        .where("projectNo", "==", projectNo)
        .where("date", "==", date)
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { workId: doc.id, ...doc.data() };
};