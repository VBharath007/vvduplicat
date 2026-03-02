
const { db } = require('../config/firebase');
const admin = require('firebase-admin');

// 1. CREATE APPROVAL (Manual Initial Entry)
exports.createApproval = async (data) => {
    const breakup = data.financials?.breakup || {};
    const totalFees = Object.values(breakup).reduce((a, b) => a + (parseFloat(b) || 0), 0);
    const initial = parseFloat(data.financials?.initialPaid || 0);
    const subsequentTotal = (data.financials?.subsequentPayments || [])
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    
    const totalPaid = initial + subsequentTotal;
    const balance = totalFees - totalPaid;

    const approvalData = {
        ...data,
        financials: {
            ...data.financials,
            totalFees,
            totalPaidSoFar: totalPaid,
            balanceToPay: balance
        },
        // Manual Status - Client starting-laye manual-aa enter pannalaam
        statusTracking: {
            currentStatus: data.statusTracking?.currentStatus || "Application Prepared",
            lastUpdated: new Date().toISOString(),
            history: data.statusTracking?.history || [] // List of manual updates
        },
        createdAt: admin.firestore.Timestamp.now()
    };

    const docRef = await db.collection('approvals').add(approvalData);
    return { id: docRef.id, ...approvalData };
};

// 2. STATUS UPDATE (Client Manual Details Entry)
// Inga dhaan client avanga details-ah enter pannuvanga
exports.updateStatus = async (id, clientInput) => {
    const docRef = db.collection('approvals').doc(id);

    // Client manual-aa kudukura details
    const newEntry = {
        status: clientInput.status || "Updated",
        date: clientInput.eventDate || new Date().toISOString(), // Client date choose pannalaam
        remarks: clientInput.remarks || "No remarks",
        actionBy: clientInput.actionBy || "Client", // Yaaru update panna?
        nextFollowUp: clientInput.nextFollowUp || "TBD" // Adutha step enna?
    };

    const updateLog = {
        "statusTracking.currentStatus": clientInput.status,
        "statusTracking.lastUpdated": new Date().toISOString(),
        // ArrayUnion panna history delete aagama mela mela add aagum
        "statusTracking.history": admin.firestore.FieldValue.arrayUnion(newEntry)
    };

    await docRef.update(updateLog);
    return { id, latestEntry: newEntry };
};