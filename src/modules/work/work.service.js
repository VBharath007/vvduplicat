const { db } = require("../../config/firebase");

const worksCollection = db.collection("works");

exports.createWork = async (workData) => {
    if (!workData.projectNo) {
        throw new Error("projectNo is required");
    }
    workData.createdAt = new Date().toISOString();

    // Ensure labour is treated as a string
    if (workData.labour !== undefined && workData.labour !== null) {
        workData.labour = String(workData.labour);
    }

    // Add document with auto-generated ID
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
