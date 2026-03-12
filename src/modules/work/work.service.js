const { db } = require("../../config/firebase");

const worksCollection = db.collection("works");

exports.createWork = async (workData) => {
    if (!workData.projectNo) {
        throw new Error("projectNo is required");
    }

    // Senior Dev Design: Unified Identity for Work Logs
    // Unique Key = (Project Number + Work Type + Date)
    // This allows multiple types of work on the same day, but prevents daily duplicates.
    const workIdentifier = (workData.work || workData.workName || workData.description || "General Work").trim();
    const workDate = workData.date || new Date().toISOString().split('T')[0];
    
    // Normalize workData date for consistency
    workData.date = workDate;

    // Search for an existing record matching all three criteria
    const existingSnapshot = await worksCollection
        .where("projectNo", "==", workData.projectNo)
        .where("date", "==", workDate)
        .get();

    let existingDoc = null;
    existingSnapshot.forEach(doc => {
        const data = doc.data();
        const currentId = (data.work || data.workName || data.description || "").trim();
        
        if (currentId.toLowerCase() === workIdentifier.toLowerCase()) {
            existingDoc = doc;
        }
    });

    if (existingDoc) {
        // Found existing work for this specific date and project - override it
        const updatePayload = { ...workData };
        delete updatePayload.createdAt; // Maintain original history
        updatePayload.updatedAt = new Date().toISOString();

        if (updatePayload.labour !== undefined && updatePayload.labour !== null) {
            updatePayload.labour = String(updatePayload.labour);
        }

        await existingDoc.ref.update(updatePayload);
        return { workId: existingDoc.id, ...existingDoc.data(), ...updatePayload };
    }

    // New work entry for this date/type - create a fresh document
    workData.createdAt = new Date().toISOString();

    if (workData.labour !== undefined && workData.labour !== null) {
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
    const works = [];
    snapshot.forEach((doc) => {
        works.push({ workId: doc.id, ...doc.data() });
    });
    return works;
};

exports.getWorkById = async (workId) => {
    const docRef = worksCollection.doc(workId);
    const doc = await docRef.get();
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

    // Protect certain fields from update
    delete updateData.workId;
    delete updateData.createdAt;

    // Ensure labour is treated as a string
    if (updateData.labour !== undefined && updateData.labour !== null) {
        updateData.labour = String(updateData.labour);
    }

    await docRef.update(updateData);

    const updatedDoc = await docRef.get();
    return { workId: updatedDoc.id, ...updatedDoc.data() };
};

exports.deleteWork = async (workId) => {
    const docRef = worksCollection.doc(workId);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new Error("Work log not found");
    }
    await docRef.delete();
    return { message: "Work log deleted successfully" };
};
