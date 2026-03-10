const { db } = require("../../config/firebase");

const advancesCollection = db.collection("advances");

exports.createAdvance = async (advanceData) => {
    if (!advanceData.projectNo) {
        throw new Error("projectNo is required");
    }

    // Default values
    advanceData.createdAt = new Date().toISOString();
    advanceData.amountReceived = Number(advanceData.amountReceived) || 0;

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
    snapshot.forEach((doc) => {
        advances.push({ advanceId: doc.id, ...doc.data() });
    });
    return advances;
};
