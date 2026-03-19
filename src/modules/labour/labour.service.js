const { db } = require("../../config/firebase");
const { LABOUR_MASTERS, SUB_LABOUR_TYPES } = require("../../models/firestore.collections");
const dayjs = require("dayjs");

const labourMasterCollection = db.collection(LABOUR_MASTERS);
const subLabourTypeCollection = db.collection(SUB_LABOUR_TYPES);

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatDate = (date) => {
    if (!date) return null;
    if (typeof date === 'string' && /^\d{2}-\d{2}-\d{2} \d{2}:\d{2}$/.test(date)) return date;
    const d = dayjs(date);
    return d.isValid() ? d.format("DD-MM-YY HH:mm") : date;
};

const now = () => dayjs().format("DD-MM-YY HH:mm");

// ─── Default Sub-Labour Types ───────────────────────────────────────────────
const DEFAULT_SUB_LABOUR_TYPES = [
    "MASON", "MC", "FC", "STEEL WORK", "SHUTTERING WORK",
    "PAINTER", "TILES", "LOADMAN"
];

exports.initDefaultSubLabourTypes = async () => {
    try {
        const timestamp = now();
        const batch = db.batch();
        let addedCount = 0;

        for (const type of DEFAULT_SUB_LABOUR_TYPES) {
            const docId = type.replace(/\s+/g, '_');
            const docRef = subLabourTypeCollection.doc(docId);
            const doc = await docRef.get();

            if (!doc.exists) {
                batch.set(docRef, {
                    typeName: type,
                    isDefault: true,
                    createdAt: timestamp,
                    updatedAt: timestamp
                });
                addedCount++;
            }
        }

        if (addedCount > 0) {
            await batch.commit();
            process.stdout.write(`ℹ Added ${addedCount} default sub-labour types.\n`);
        } else {
            process.stdout.write("ℹ Default sub-labour types already exist.\n");
        }
    } catch (error) {
        process.stdout.write("❌ Error initializing default sub-labours: " + error.message + "\n");
    }
};

// ─── Head Labour Master CRUD ────────────────────────────────────────────────

/**
 * Adds a new head labour/contractor to the Global Master Registry.
 * Strict Normalization: name → UPPERCASE, trimmed.
 * Duplicate Guard: rejects if the same normalized name already exists.
 */
exports.addLabourMaster = async (data) => {
    if (!data.name) throw new Error("name is required");
    const normalizedName = data.name.trim().toUpperCase();

    // Duplicate Guard – prevent two masters with the same name
    const existing = await labourMasterCollection
        .where("name", "==", normalizedName).limit(1).get();
    if (!existing.empty) {
        throw new Error(`Head labour '${normalizedName}' already exists`);
    }

    const newLabour = {
        name: normalizedName,
        contact: data.contact || "N/A",
        createdAt: now()
    };
    const docRef = await labourMasterCollection.add(newLabour);
    return { id: docRef.id, ...newLabour };
};

/**
 * Updates head labour master.
 * Integrity: name is re-normalized if provided.
 */
exports.updateLabourMaster = async (id, data) => {
    const docRef = labourMasterCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Head labour master not found");

    const updateData = { ...data, updatedAt: now() };
    if (updateData.name) updateData.name = updateData.name.trim().toUpperCase();

    await docRef.update(updateData);
    const updated = await docRef.get();
    return { id, ...updated.data() };
};

exports.deleteLabourMaster = async (id) => {
    const docRef = labourMasterCollection.doc(id);
    if (!(await docRef.get()).exists) throw new Error("Head labour master not found");
    await docRef.delete();
    return { message: "Head labour master deleted successfully" };
};

exports.getLabourMasters = async () => {
    const snap = await labourMasterCollection.orderBy("name", "asc").get();
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: formatDate(data.createdAt),
            updatedAt: formatDate(data.updatedAt)
        };
    });
};

/**
 * Fetches a single head labour master by its Firestore document ID.
 */
exports.getLabourMasterById = async (id) => {
    const doc = await labourMasterCollection.doc(id).get();
    if (!doc.exists) throw new Error("Head labour master not found");
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: formatDate(data.createdAt),
        updatedAt: formatDate(data.updatedAt)
    };
};

/**
 * Fetches a single head labour master by normalized name.
 */
exports.getLabourMasterByName = async (name) => {
    const normalized = name.trim().toUpperCase();
    const snap = await labourMasterCollection
        .where("name", "==", normalized).limit(1).get();
    if (snap.empty) throw new Error(`Head labour '${normalized}' not found in Master Registry`);
    const doc = snap.docs[0];
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: formatDate(data.createdAt),
        updatedAt: formatDate(data.updatedAt)
    };
};

// ─── Sub-Labour Type CRUD ───────────────────────────────────────────────────

/**
 * Adds or updates a sub-labour type (upsert by normalized name).
 * Used for both default and custom "OTHERS" types.
 */
exports.addOtherSubLabourType = async (typeName) => {
    if (!typeName) throw new Error("typeName is required");
    const normalized = typeName.trim().toUpperCase();
    const docId = normalized.replace(/\s+/g, '_');
    const docRef = subLabourTypeCollection.doc(docId);

    const data = {
        typeName: normalized,
        isDefault: false,
        updatedAt: now()
    };

    // Merge → create or update
    await docRef.set(data, { merge: true });

    // Ensure createdAt exists for new docs
    const doc = await docRef.get();
    if (!doc.data().createdAt) {
        await docRef.update({ createdAt: now() });
    }

    const finalDoc = await docRef.get();
    const finalData = finalDoc.data();
    return {
        id: docId,
        ...finalData,
        createdAt: formatDate(finalData.createdAt),
        updatedAt: formatDate(finalData.updatedAt)
    };
};

exports.getSubLabourTypes = async () => {
    const snap = await subLabourTypeCollection.orderBy("typeName", "asc").get();
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: formatDate(data.createdAt),
            updatedAt: formatDate(data.updatedAt)
        };
    });
};
// ─── Sub-Labour Type Edit & Delete ─────────────────────────────────────────

/**
 * Edit an existing sub-labour type name.
 * Cannot rename default types — only custom ones.
 */
exports.updateSubLabourType = async (id, data) => {
    const docRef = subLabourTypeCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error(`Sub-labour type '${id}' not found`);

    const existing = doc.data();
    if (existing.isDefault) {
        throw new Error(`Cannot edit default sub-labour type '${existing.typeName}'`);
    }

    const updateData = { updatedAt: now() };
    if (data.typeName || data.labourType) {
        updateData.typeName = (data.typeName || data.labourType).trim().toUpperCase();
    }

    await docRef.update(updateData);
    const updated = await docRef.get();
    const updatedData = updated.data();
    return {
        id,
        ...updatedData,
        createdAt: formatDate(updatedData.createdAt),
        updatedAt: formatDate(updatedData.updatedAt)
    };
};

/**
 * Delete a sub-labour type.
 * Cannot delete default types — only custom ones.
 */
exports.deleteSubLabourType = async (id) => {
    const docRef = subLabourTypeCollection.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error(`Sub-labour type '${id}' not found`);

    const existing = doc.data();
    if (existing.isDefault) {
        throw new Error(`Cannot delete default sub-labour type '${existing.typeName}'`);
    }

    await docRef.delete();
    return { message: `Sub-labour type '${existing.typeName}' deleted successfully` };
};