const { db } = require("../../config/firebase");
const { WORKS } = require("../../models/firestore.collections");
const labourService = require("../labour/labour.service");
const dayjs = require("dayjs");

const worksCollection = db.collection(WORKS);

// ─── Helpers ────────────────────────────────────────────────────────────────
const now = () => dayjs().format("DD-MM-YY HH:mm");

/**
 * Builds a live labourDetails object for enrichment.
 * Resolves the head labour's current name/contact from the registry.
 * Uses the stored counts if available, otherwise returns zeros.
 */
const buildLabourDetails = async (storedLabourDetails) => {
    const headLabourId = storedLabourDetails?.headLabourId;
    const masters = await labourService.getLabourMasters();
    const subTypes = await labourService.getSubLabourTypes();

    const subLabourDetailsMap = {};
    // Initialize all known types with 0
    subTypes.forEach(t => {
        subLabourDetailsMap[t.typeName] = 0;
    });

    // Merge in stored counts from the work log if they exist
    if (storedLabourDetails?.subLabourDetails) {
        Object.keys(storedLabourDetails.subLabourDetails).forEach(key => {
            subLabourDetailsMap[key] = storedLabourDetails.subLabourDetails[key];
        });
    }

    let headLabourName = "N/A";
    let headLabourPhoneNumber = "N/A";
    let resolvedId = null;

    if (headLabourId) {
        try {
            const master = await labourService.getLabourMasterById(headLabourId);
            headLabourName = master.name;
            headLabourPhoneNumber = master.contact;
            resolvedId = master.id;
        } catch (_) { }
    }

    if (!resolvedId && masters.length > 0) {
        headLabourName = masters[0].name;
        headLabourPhoneNumber = masters[0].contact;
        resolvedId = masters[0].id;
    }

    const result = {
        headLabourId: resolvedId,
        headLabourName,
        headLabourPhoneNumber,
    };

    // Include sub-labour details + total if they were explicitly provided/stored
    if (storedLabourDetails?.subLabourDetails) {
        result.subLabourDetails = subLabourDetailsMap;
        result.totalLabourCount = Object.values(subLabourDetailsMap).reduce((sum, v) => sum + v, 0);
    }

    return result;
};

/**
 * CONCEPT:
 * - Each work name is UNIQUE per project (e.g. "Pillar shuttering" = 1 doc).
 * - Every day the user updates that work → same doc gets updated (date changes).
 * - tomorrowWork from today auto-fills as workName for next day on Flutter side.
 * - You CANNOT create two docs with the same workName for the same project.
 *
 * Upsert rule:
 * - workId provided                    → direct update by ID (edit flow).
 * - No workId, existing workName found → UPDATE that doc (regardless of date).
 * - No workId, new workName            → CREATE new doc.
 *
 * Example flow:
 *   Day 12: workName="Pillar shuttering", tomorrowWork="Ceiling shuttering" → NEW doc created
 *   Day 13: workName="Ceiling shuttering" (auto-filled from tomorrowWork)   → NEW doc created
 *   Day 13: workName="Pillar shuttering" again                               → UPDATES existing doc (not a new one)
 */
exports.createWork = async (workData) => {
    const { projectNo, work, tomorrowWork } = workData;
    if (!projectNo) throw new Error("projectNo is required");

    const name = (work || "General Work").trim().toUpperCase();
    const workDate = dayjs().format("DD-MM-YYYY");

    const payload = {
        projectNo,
        work: name,
        workName: name,
        tomorrowWork: (tomorrowWork || "").trim(),
        date: workDate,
        createdAt: now()
    };

    // ── UPSERT: unique key = projectNo + work ──
    const existingSnapshot = await worksCollection
        .where("projectNo", "==", projectNo)
        .where("work", "==", name)
        .limit(1)
        .get();

    if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];
        const updatePayload = { ...payload };
        delete updatePayload.createdAt;
        updatePayload.updatedAt = now();

        await existingDoc.ref.update(updatePayload);
        const updated = await existingDoc.ref.get();
        return { workId: updated.id, ...updated.data() };
    }

    const docRef = await worksCollection.add(payload);
    return { workId: docRef.id, ...payload };
};

// ═══════════════════════════════════════════════════════════════════════════
// ASSIGN HEAD LABOUR TO A WORK  (Hierarchical Labour Assignment)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Links a headLabourId from the Master Registry to a specific work document.
 *
 * @param {string} projectNo   – must match the work's projectNo
 * @param {string} workId      – Firestore doc ID of the work
 * @param {string} headLabourId – Firestore doc ID from labourMaster collection
 * @param {object} [subLabourDetails] – optional override: { "MASON": 4, "MC": 3, ... }
 */
exports.assignLabourToWork = async (projectNo, workId, headLabourId, subLabourDetails) => {
    // 1. Verify work exists & belongs to this project
    const workRef = worksCollection.doc(workId);
    const workDoc = await workRef.get();
    if (!workDoc.exists) throw new Error("Work log not found");
    const docData = workDoc.data();
    if (docData.projectNo !== projectNo) {
        throw new Error(`Work '${workId}' does not belong to project '${projectNo}'`);
    }

    // 2. Verify headLabourId exists in the Master Registry
    const master = await labourService.getLabourMasterById(headLabourId);

    // 3. Prepare labourDetails
    const labourDetails = {
        ...(docData.labourDetails || {}),
        headLabourId: master.id,
        headLabourName: master.name,
        headLabourPhoneNumber: master.contact
    };

    // 4. Update sub-labours only if provided
    if (subLabourDetails && typeof subLabourDetails === 'object') {
        const subMap = {};
        for (const [key, val] of Object.entries(subLabourDetails)) {
            subMap[key.trim().toUpperCase()] = Number(val) || 0;
        }
        labourDetails.subLabourDetails = subMap;
    }

    // 5. Persist the link
    await workRef.update({
        labourDetails,
        updatedAt: now()
    });

    const updated = await workRef.get();
    const finalData = updated.data();

    // If sub-labours not provided, omit subLabourDetails from response
    if (!subLabourDetails) {
        const responseData = { ...finalData };
        if (responseData.labourDetails) {
            const cleanLabour = { ...responseData.labourDetails };
            delete cleanLabour.subLabourDetails;
            responseData.labourDetails = cleanLabour;
        }
        return { workId: updated.id, ...responseData };
    }

    return { workId: updated.id, ...finalData };
};

/**
 * Updates ONLY the sub-labour counts for a specific work log.
 * Merges with existing sub-labour details.
 */
exports.updateSubLabourForWork = async (projectNo, workId, subLabourDetails) => {
    // 1. Verify work exists & belongs to this project
    const workRef = worksCollection.doc(workId);
    const workDoc = await workRef.get();
    if (!workDoc.exists) throw new Error("Work log not found");
    const docData = workDoc.data();
    if (docData.projectNo !== projectNo) {
        throw new Error(`Work '${workId}' does not belong to project '${projectNo}'`);
    }

    // 2. Prepare the updates (normalize incoming data)
    const incomingSubMap = {};
    if (subLabourDetails && typeof subLabourDetails === 'object') {
        for (const [key, val] of Object.entries(subLabourDetails)) {
            incomingSubMap[key.trim().toUpperCase()] = Number(val) || 0;
        }
    }

    // 3. MERGE with existing sub-labour details from the database
    const existingSubMap = docData.labourDetails?.subLabourDetails || {};
    const finalSubMap = { ...existingSubMap, ...incomingSubMap };

    // 5. Build and persist the updated labourDetails
    const updatedLabourDetails = {
        ...(docData.labourDetails || {}),
        subLabourDetails: finalSubMap,
    };

    await workRef.update({
        labourDetails: updatedLabourDetails,
        updatedAt: now()
    });

    const updated = await workRef.get();
    const finalData = { workId: updated.id, ...updated.data() };

    // Enrich for the response (relational names, etc.)
    finalData.labourDetails = await buildLabourDetails(finalData.labourDetails);

    return finalData;
};




// ═══════════════════════════════════════════════════════════════════════════
// GET WORKS (with live labour enrichment)
// ═══════════════════════════════════════════════════════════════════════════
exports.getWorks = async (projectNo) => {
    let query = worksCollection;
    if (projectNo) {
        query = query.where("projectNo", "==", projectNo);
    }
    const snapshot = await query.get();
    let works = snapshot.docs.map((doc) => ({ workId: doc.id, ...doc.data() }));

    // Enrich each work with live labour details
    for (let i = 0; i < works.length; i++) {
        works[i].labourDetails = await buildLabourDetails(works[i].labourDetails);
    }


    // Sort by date DESC, then work name ASC
    return works.sort((a, b) => {
        const dateA = dayjs(a.date, "DD-MM-YYYY");
        const dateB = dayjs(b.date, "DD-MM-YYYY");
        if (dateB.isAfter(dateA)) return 1;
        if (dateB.isBefore(dateA)) return -1;
        return (a.work || "").localeCompare(b.work || "");
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// STANDARD CRUD
// ═══════════════════════════════════════════════════════════════════════════
exports.getWorkById = async (workId, projectNo = null) => {
    const doc = await worksCollection.doc(workId).get();
    if (!doc.exists) throw new Error("Work log not found");

    const work = { workId: doc.id, ...doc.data() };

    // Validation: ensure work belongs to the project if projectNo provided
    if (projectNo && work.projectNo !== projectNo) {
        throw new Error(`Work log '${workId}' does not belong to project '${projectNo}'`);
    }

    work.labourDetails = await buildLabourDetails(work.labourDetails);
    return work;
};


exports.updateWork = async (workId, updateData) => {
    const docRef = worksCollection.doc(workId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Work log not found");

    delete updateData.workId;
    delete updateData.createdAt;
    updateData.updatedAt = now();

    // Normalize work names if being updated
    if (updateData.work) updateData.work = updateData.work.trim().toUpperCase();
    if (updateData.workName) updateData.workName = updateData.workName.trim().toUpperCase();

    await docRef.update(updateData);
    const updated = await docRef.get();
    return { workId: updated.id, ...updated.data() };
};

exports.deleteWork = async (workId) => {
    const docRef = worksCollection.doc(workId);
    if (!(await docRef.get()).exists) throw new Error("Work log not found");
    await docRef.delete();
    return { message: "Work log deleted successfully" };
};

/**
 * Get work documents for a specific project + date.
 */
exports.getWorkByDate = async (projectNo, date) => {
    const snapshot = await worksCollection
        .where("projectNo", "==", projectNo)
        .where("date", "==", date)
        .get();

    if (snapshot.empty) return null;
    const docs = snapshot.docs.map(doc => ({ workId: doc.id, ...doc.data() }));
    return docs.length === 1 ? docs[0] : docs;
};
// ═══════════════════════════════════════════════════════════════════════════
// EDIT ONE SUB-LABOUR COUNT
// ═══════════════════════════════════════════════════════════════════════════
exports.editSubLabourCount = async (projectNo, workId, type, count) => {
    const workRef = worksCollection.doc(workId);
    const workDoc = await workRef.get();
    if (!workDoc.exists) throw new Error("Work log not found");

    const docData = workDoc.data();
    if (docData.projectNo !== projectNo) {
        throw new Error(`Work '${workId}' does not belong to project '${projectNo}'`);
    }

    const normalizedType = type.trim().toUpperCase();
    const existingSubMap = docData.labourDetails?.subLabourDetails || {};

    if (!(normalizedType in existingSubMap)) {
        throw new Error(`Sub-labour type '${normalizedType}' not found in this work`);
    }

    const updatedSubMap = { ...existingSubMap, [normalizedType]: Number(count) || 0 };

    const updatedLabourDetails = {
        ...(docData.labourDetails || {}),
        subLabourDetails: updatedSubMap,
    };

    await workRef.update({ labourDetails: updatedLabourDetails, updatedAt: now() });

    const updated = await workRef.get();
    const finalData = { workId: updated.id, ...updated.data() };
    finalData.labourDetails = await buildLabourDetails(finalData.labourDetails);
    return finalData;
};

// ═══════════════════════════════════════════════════════════════════════════
// DELETE ONE SUB-LABOUR TYPE FROM A WORK
// ═══════════════════════════════════════════════════════════════════════════
exports.deleteSubLabourType = async (projectNo, workId, type) => {
    const workRef = worksCollection.doc(workId);
    const workDoc = await workRef.get();
    if (!workDoc.exists) throw new Error("Work log not found");

    const docData = workDoc.data();
    if (docData.projectNo !== projectNo) {
        throw new Error(`Work '${workId}' does not belong to project '${projectNo}'`);
    }

    const normalizedType = type.trim().toUpperCase();
    const existingSubMap = { ...(docData.labourDetails?.subLabourDetails || {}) };

    if (!(normalizedType in existingSubMap)) {
        throw new Error(`Sub-labour type '${normalizedType}' not found in this work`);
    }

    delete existingSubMap[normalizedType];

    const updatedLabourDetails = {
        ...(docData.labourDetails || {}),
        subLabourDetails: existingSubMap,
    };

    await workRef.update({ labourDetails: updatedLabourDetails, updatedAt: now() });

    const updated = await workRef.get();
    const finalData = { workId: updated.id, ...updated.data() };
    finalData.labourDetails = await buildLabourDetails(finalData.labourDetails);
    return finalData;
};

// ═══════════════════════════════════════════════════════════════════════════
// WEEK FILTER — Mon to Sat date range
// GET /api/works/project/:projectNo/week?from=16-03-2026&to=21-03-2026
// ═══════════════════════════════════════════════════════════════════════════
exports.getWorksByWeek = async (projectNo, from, to) => {
    if (!projectNo || !from || !to) {
        throw new Error("projectNo, from, and to are required");
    }

    const snapshot = await worksCollection
        .where("projectNo", "==", projectNo)
        .get();

    if (snapshot.empty) return [];

    const fromDay = dayjs(from, "DD-MM-YYYY");
    const toDay = dayjs(to, "DD-MM-YYYY");

    const works = snapshot.docs
        .map(doc => ({ workId: doc.id, ...doc.data() }))
        .filter(w => {
            const workDay = dayjs(w.date, "DD-MM-YYYY");
            return (
                workDay.isValid() &&
                (workDay.isSame(fromDay) || workDay.isAfter(fromDay)) &&
                (workDay.isSame(toDay) || workDay.isBefore(toDay))
            );
        })
        .sort((a, b) =>
            dayjs(a.date, "DD-MM-YYYY").valueOf() -
            dayjs(b.date, "DD-MM-YYYY").valueOf()
        );

    // Enrich with live labour details
    for (let i = 0; i < works.length; i++) {
        works[i].labourDetails = await buildLabourDetails(works[i].labourDetails);
    }

    return works;
};

// ═══════════════════════════════════════════════════════════════════════════
// REVERSE LOOKUP — all works/projects a labour was assigned to
// GET /api/labours/master/:labourId/works
// ═══════════════════════════════════════════════════════════════════════════
exports.getWorksByLabour = async (labourId) => {
    if (!labourId) throw new Error("labourId is required");

    const snapshot = await worksCollection
        .where("labourDetails.headLabourId", "==", labourId)
        .get();

    if (snapshot.empty) return { projects: [], totalWorks: 0 };

    const works = snapshot.docs.map(doc => ({ workId: doc.id, ...doc.data() }));

    // Group by projectNo
    const projectMap = {};
    works.forEach(w => {
        const pNo = w.projectNo;
        if (!projectMap[pNo]) {
            projectMap[pNo] = {
                projectNo: pNo,
                works: [],
            };
        }
        projectMap[pNo].works.push({
            workId: w.workId,
            workName: w.work || w.workName,
            date: w.date,
            subLabourDetails: w.labourDetails?.subLabourDetails || {},
            totalLabourCount: w.labourDetails?.totalLabourCount || 0,
        });
    });

    // Sort each project's works by date desc
    const projects = Object.values(projectMap).map(p => ({
        ...p,
        works: p.works.sort((a, b) =>
            dayjs(b.date, "DD-MM-YYYY").valueOf() -
            dayjs(a.date, "DD-MM-YYYY").valueOf()
        ),
        latestDate: p.works[0]?.date || null,
        totalWorks: p.works.length,
    }));

    return {
        labourId,
        projects,
        totalWorks: works.length,
    };
};