const { db } = require("../../config/firebase");
const { ADDITIONAL_WORKS } = require("../../models/firestore.collections");

const additionalWorksCollection = db.collection(ADDITIONAL_WORKS);

/**
 * Add a new additional work payment entry
 * @param {Object} data 
 * @returns {Object} created document
 */
exports.addAdditionalWork = async (data) => {
    const { workTitle, projectNo, totalAmount, receivedAmount, date, remarks } = data;
    
    if (!workTitle) throw new Error("Work Title is required");
    if (!projectNo) throw new Error("Project Number is required");

    const total = Number(totalAmount) || 0;
    const received = Number(receivedAmount) || 0;
    const balance = total - received;

    const newEntry = {
        workTitle: workTitle.trim(),
        projectNo: projectNo.trim(),
        totalAmount: total,
        receivedAmount: received,
        balance: balance,
        remarks: remarks || "",
        date: date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const docRef = await additionalWorksCollection.add(newEntry);
    return { id: docRef.id, ...newEntry };
};

/**
 * Get all additional work entries, optionally filtered by project
 * @param {string} projectNo 
 * @returns {Array} list of entries
 */
exports.getAdditionalWorks = async (projectNo = null) => {
    let query = additionalWorksCollection.orderBy("createdAt", "desc");
    
    if (projectNo) {
        query = query.where("projectNo", "==", projectNo);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Get a single additional work entry by ID
 * @param {string} id 
 * @returns {Object} entry
 */
exports.getAdditionalWorkById = async (id) => {
    const doc = await additionalWorksCollection.doc(id).get();
    if (!doc.exists) throw new Error("Additional work entry not found");
    return { id: doc.id, ...doc.data() };
};

/**
 * Update an additional work entry
 * @param {string} id 
 * @param {Object} data 
 * @returns {Object} updated entry
 */
exports.updateAdditionalWork = async (id, data) => {
    const docRef = additionalWorksCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Additional work entry not found");

    const existingData = doc.data();
    const updates = { ...data, updatedAt: new Date().toISOString() };
    
    delete updates.id;
    delete updates.createdAt;

    // Handle numeric fields and recalculate balance
    const total = updates.totalAmount !== undefined ? Number(updates.totalAmount) : existingData.totalAmount;
    const received = updates.receivedAmount !== undefined ? Number(updates.receivedAmount) : existingData.receivedAmount;
    
    updates.totalAmount = total;
    updates.receivedAmount = received;
    updates.balance = total - received;

    await docRef.update(updates);
    const updated = await docRef.get();
    return { id, ...updated.data() };
};

/**
 * Delete an additional work entry
 * @param {string} id 
 * @returns {Object} status message
 */
exports.deleteAdditionalWork = async (id) => {
    const docRef = additionalWorksCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Additional work entry not found");

    await docRef.delete();
    return { message: "Additional work entry deleted successfully", id };
};
