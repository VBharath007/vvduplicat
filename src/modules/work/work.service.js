const { db } = require("../../config/firebase");

const worksCollection = db.collection("works");

/**
 * CONCEPT:
 * - Each work name is UNIQUE per project (e.g. "Pillar shuttering" = 1 doc).
 * - Every day the user updates that work → same doc gets updated (date changes).
 * - tomorrowWork from today auto-fills as workName for next day on Flutter side.
 * - You CANNOT create two docs with the same workName for the same project.
 *
 * Upsert rule:
 * - workId provided                    → direct update by ID (edit flow).
 * - No workId, existing workName found → UPDATE that doc (regardless of date).
 * - No workId, new workName            → CREATE new doc.
 *
 * Example flow:
 *   Day 12: workName="Pillar shuttering", tomorrowWork="Ceiling shuttering" → NEW doc created
 *   Day 13: workName="Ceiling shuttering" (auto-filled from tomorrowWork)   → NEW doc created
 *   Day 13: workName="Pillar shuttering" again                               → UPDATES existing doc (not a new one)
 */
exports.createWork = async (workData) => {
    if (!workData.projectNo) {
        throw new Error("projectNo is required");
    }

    const workDate = workData.date || new Date().toISOString().split("T")[0];
    workData.date = workDate;

    // Normalize — keep both 'work' and 'workName' in sync for Flutter
    const name = (workData.work || workData.workName || "General Work").trim();
    workData.work = name;
    workData.workName = name;

    // ── EDIT FLOW: workId supplied → direct overwrite ────────────────────────
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

    // ── UPSERT FLOW: unique key = projectNo + workName (date does NOT matter) ─
    // Same work name on a different date = update the existing doc, not a new one.
    const existingSnapshot = await worksCollection
        .where("projectNo", "==", workData.projectNo)
        .where("work", "==", name)
        .limit(1)
        .get();

    if (!existingSnapshot.empty) {
        // Work name already exists for this project → update it
        const existingDoc = existingSnapshot.docs[0];
        const updatePayload = { ...workData };
        delete updatePayload.createdAt;
        updatePayload.updatedAt = new Date().toISOString();
        if (updatePayload.labour != null) updatePayload.labour = String(updatePayload.labour);

        await existingDoc.ref.update(updatePayload);
        const updated = await existingDoc.ref.get();
        return { workId: updated.id, ...updated.data() };
    }

    // ── Truly new work name → create new doc ────────────────────────────────
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
    const works = snapshot.docs.map((doc) => ({ workId: doc.id, ...doc.data() }));

    // Sort by date DESC (latest first) then by work name ASC
    return works.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
        return (a.work || "").localeCompare(b.work || "");
    });
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