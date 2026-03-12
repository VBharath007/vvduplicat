const { db } = require("../../config/firebase");

const advancesCollection = db.collection("advances");

exports.createAdvance = async (advanceData) => {
    if (!advanceData.projectNo) {
        throw new Error("projectNo is required");
    }

    // Default values
    advanceData.createdAt = new Date().toISOString();
    advanceData.amountReceived = Number(advanceData.amountReceived) || 0;

    // Automatically calculate pastAdvance from previous entries if not provided
    if (advanceData.pastAdvance === undefined || advanceData.pastAdvance === null) {
        const snapshot = await advancesCollection.where("projectNo", "==", advanceData.projectNo).get();
        let totalPrevious = 0;
        snapshot.forEach(doc => {
            totalPrevious += (Number(doc.data().amountReceived) || 0);
        });
        advanceData.pastAdvance = totalPrevious;
    } else {
        advanceData.pastAdvance = Number(advanceData.pastAdvance) || 0;
    }

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
        
        // Per-row overall total (add add)
        const rowTotal = amountReceived + pastAdvance;
        
        totalProjectAmount += amountReceived; // Sum only current to avoid double counting if past is carry-over
        
        advances.push({ 
            advanceId: doc.id, 
            ...data,
            rowTotal: rowTotal // show as overall/total for this record
        });
    });

    return { 
        advances, 
        totalAdvance: totalProjectAmount // This is the sum of all current entries
    };
};
