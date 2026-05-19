const { db } = require("../../config/firebase");
const { EXTRA_WORKS } = require("../../models/firestore.collections");

const extraWorksCollection = db.collection(EXTRA_WORKS);

/**
 * Add a new extra work entry/note
 * @param {Object} data 
 * @returns {Object} created document
 */
exports.addExtraWork = async (data) => {
    const { title, description, projectNo, amount, balance, date, type } = data;
    
    if (!title) throw new Error("Title is required");

    const newEntry = {
        title: title.trim(),
        description: description || "",
        projectNo: projectNo || "N/A",
        amount: Number(amount) || 0,
        balance: Number(balance) || 0,
        type: type || "General", // e.g., "Addition Work", "Material Receipt", etc.
        date: date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const docRef = await extraWorksCollection.add(newEntry);
    return { id: docRef.id, ...newEntry };
};

/**
 * Get all extra work entries, optionally filtered by project
 * @param {string} projectNo 
 * @returns {Array} list of entries
 */
exports.getExtraWorks = async (projectNo = null) => {
    let query = extraWorksCollection;
    
    if (projectNo) {
        query = query.where("projectNo", "==", projectNo);
    }

    const snapshot = await query.get();
    let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort manually by createdAt desc to avoid composite index requirement
    results.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
    });

    return results;
};

/**
 * Get a single extra work entry by ID
 * @param {string} id 
 * @returns {Object} entry
 */
exports.getExtraWorkById = async (id) => {
    const doc = await extraWorksCollection.doc(id).get();
    if (!doc.exists) throw new Error("Extra work entry not found");
    return { id: doc.id, ...doc.data() };
};

/**
 * Update an extra work entry
 * @param {string} id 
 * @param {Object} data 
 * @returns {Object} updated entry
 */
exports.updateExtraWork = async (id, data) => {
    const docRef = extraWorksCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Extra work entry not found");

    const updates = { ...data, updatedAt: new Date().toISOString() };
    delete updates.id;
    delete updates.createdAt;

    // Ensure numeric fields are numbers
    if (updates.amount !== undefined) updates.amount = Number(updates.amount);
    if (updates.balance !== undefined) updates.balance = Number(updates.balance);

    await docRef.update(updates);
    const updated = await docRef.get();
    return { id, ...updated.data() };
};

/**
 * Delete an extra work entry
 * @param {string} id 
 * @returns {Object} status message
 */
exports.deleteExtraWork = async (id) => {
    const docRef = extraWorksCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Extra work entry not found");

    await docRef.delete();
    return { message: "Extra work entry deleted successfully", id };
};
