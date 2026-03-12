const { db } = require("../../config/firebase");

const worksCollection = db.collection("works");

exports.createWork = async (workData) => {
    if (!workData.projectNo) {
        throw new Error("projectNo is required");
    }
    if (!workData.work) {
        throw new Error("work name/type is required (e.g. 'Ceiling Work')");
    }

    // Deep Analysis: Working with 15 years experience, we implement a 'Smart Merge'
    // to ensure different UI modules (Required vs Received) don't overwrite each other.

    const existingSnapshot = await worksCollection
        .where("projectNo", "==", workData.projectNo)
        .where("work", "==", workData.work)
        .limit(1)
        .get();

    if (!existingSnapshot.empty) {
        const doc = existingSnapshot.docs[0];
        const existingData = doc.data();
        const docRef = worksCollection.doc(doc.id);

        const updatePayload = {
            updatedAt: new Date().toISOString()
        };

        // 1️⃣ LOGIC: Modular Override (Only update provided non-empty fields)
        const fieldsToOverride = ['labour', 'status', 'description', 'unit', 'rate', 'materialName'];
        fieldsToOverride.forEach(field => {
            if (workData[field] !== undefined && workData[field] !== null && workData[field] !== "") {
                updatePayload[field] = String(workData[field]);
            }
        });

        // 2️⃣ LOGIC: Material Required (Update/Override latest plan)
        if (workData.materialRequired !== undefined && workData.materialRequired !== null && workData.materialRequired !== "") {
            updatePayload.materialRequired = Number(workData.materialRequired) || 0;
        }

        // 3️⃣ LOGIC: Material Received (ADDITIVE update)
        // As per request: "onlyy add the meterial recived"
        if (workData.materialReceived !== undefined && workData.materialReceived !== null && workData.materialReceived !== "") {
            const incomingAmount = Number(workData.materialReceived) || 0;
            const currentAmount = Number(existingData.materialReceived) || 0;
            updatePayload.materialReceived = currentAmount + incomingAmount;
        }

        await docRef.update(updatePayload);
        const updatedDoc = await docRef.get();
        return { workId: updatedDoc.id, ...updatedDoc.data(), status: "updated" };

    } else {
        // CREATE new work document
        const newWork = {
            ...workData,
            materialRequired: Number(workData.materialRequired) || 0,
            materialReceived: Number(workData.materialReceived) || 0,
            createdAt: new Date().toISOString()
        };

        // Ensure labour is string
        if (newWork.labour) newWork.labour = String(newWork.labour);

        const docRef = await worksCollection.add(newWork);
        return { workId: docRef.id, ...newWork, status: "created" };
    }
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
