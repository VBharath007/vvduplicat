const { db } = require("../../config/firebase");

const advancesCollection = db.collection("advances");

exports.createAdvance = async (advanceData) => {
    if (!advanceData.projectNo) {
        throw new Error("projectNo is required");
    }

    // Default values
    advanceData.createdAt = new Date().toISOString();
    advanceData.amountReceived = Number(advanceData.amountReceived) || 0;

    // ALWAYS recalculate pastAdvance from DB — never trust the client value.
    // Bug was: client sends pastAdvance:0 explicitly (e.g. copied from a prior
    // fetched entry), so the old `=== undefined || === null` check was skipped
    // and 0 was stored as-is even for sno-2, sno-3, etc.
    const snapshot = await advancesCollection
        .where("projectNo", "==", advanceData.projectNo)
        .get();
    let totalPrevious = 0;
    snapshot.forEach(doc => {
        totalPrevious += (Number(doc.data().amountReceived) || 0);
    });
    advanceData.pastAdvance = totalPrevious; // sum of ALL prior advances for this project

    const docRef = await advancesCollection.add(advanceData);
    return { advanceId: docRef.id, ...advanceData };
};

exports.getAdvances = async (projectNo) => {
    let query = advancesCollection;
    if (projectNo) {
        query = query.where("projectNo", "==", projectNo);
    }
    const snapshot = await query.get();
    const advances = [];
    let totalProjectAmount = 0;

    snapshot.forEach((doc) => {
        const data = doc.data();
        const amountReceived = Number(data.amountReceived) || 0;
        const pastAdvance = Number(data.pastAdvance) || 0;

        // Per-row overall total (cumulative)
        const rowTotal = amountReceived + pastAdvance;

        totalProjectAmount += amountReceived; // Sum only current to avoid double counting

        advances.push({
            advanceId: doc.id,
            ...data,
            rowTotal: rowTotal
        });
    });

    return {
        advances,
        totalAdvance: totalProjectAmount
    };
};