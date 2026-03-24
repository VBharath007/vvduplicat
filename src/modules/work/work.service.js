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
    if (!storedLabourDetails || Object.keys(storedLabourDetails).length === 0) return {};

    const masters = await labourService.getLabourMasters();
    const subTypes = await labourService.getSubLabourTypes();

    const fetchMasterInfo = (hId) => {
        let name = "N/A", phone = "N/A";
        const m = masters.find(x => x.id === hId);
        if (m) { name = m.name; phone = m.contact; }
        return { name, phone };
    };

    const processEntry = (entry) => {
        const subMap = {};
        subTypes.forEach(t => subMap[t.typeName] = 0);
        if (entry.subLabourDetails) {
            Object.keys(entry.subLabourDetails).forEach(k => {
                subMap[k] = entry.subLabourDetails[k];
            });
        }
        let { name, phone } = fetchMasterInfo(entry.headLabourId);

        return {
            headLabourId: entry.headLabourId,
            headLabourName: name !== "N/A" ? name : (entry.headLabourName || "N/A"),
            headLabourPhoneNumber: phone !== "N/A" ? phone : (entry.headLabourPhoneNumber || "N/A"),
            subLabourDetails: subMap,
            totalLabourCount: Object.values(subMap).reduce((s, v) => s + v, 0)
        };
    };

    // LEGACY SUPPORT: If old data hasn't been migrated yet, it will be a single flat object
    if (storedLabourDetails.headLabourId && typeof storedLabourDetails.headLabourId === 'string') {
        const processed = processEntry(storedLabourDetails);
        return { [processed.headLabourId]: processed };
    }

    // MULTIPLE HEAD LABOUR SUPPORT (Keyed Map)
    const newMap = {};
    for (const key of Object.keys(storedLabourDetails)) {
        newMap[key] = processEntry(storedLabourDetails[key]);
    }
    return newMap;
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

    // work field empty-aa irundha create panna vendam
    // Flutter "Save Details" press panna panna empty work create aagaathu
    if (!work || !work.trim()) {
        throw new Error("work (work name) is required. Please enter a work name before saving.");
    }

    const name = work.trim().toUpperCase();
    const workDate = dayjs().format("DD-MM-YYYY");

    const payload = {
        projectNo,
        work: name,
        workName: name,
        tomorrowWork: (tomorrowWork || "").trim(),
        date: workDate,
        createdAt: now(),
        labourDetails: {} // Standardize by ensuring new entries have this property
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
        // Don't overwrite existing labourDetails on upsert if it already has one!
        if (existingDoc.data().labourDetails !== undefined) {
            delete updatePayload.labourDetails;
        }
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
    const workRef = worksCollection.doc(workId);
    const workDoc = await workRef.get();
    if (!workDoc.exists) throw new Error("Work log not found");
    const docData = workDoc.data();
    if (docData.projectNo !== projectNo) {
        throw new Error(`Work '${workId}' does not belong to project '${projectNo}'`);
    }

    const master = await labourService.getLabourMasterById(headLabourId);

    // Convert legacy object into a keyed map if necessary
    let map = docData.labourDetails || {};
    if (map.headLabourId && typeof map.headLabourId === 'string') {
        map = { [map.headLabourId]: map };
    }

    // Establish the isolated entry for this specific Head Labour
    const existingEntry = map[master.id] || {};

    map[master.id] = {
        ...existingEntry,
        headLabourId: master.id,
        headLabourName: master.name,
        headLabourPhoneNumber: master.contact
    };

    if (subLabourDetails && typeof subLabourDetails === 'object') {
        const subMap = {};
        for (const [key, val] of Object.entries(subLabourDetails)) {
            subMap[key.trim().toUpperCase()] = Number(val) || 0;
        }
        map[master.id].subLabourDetails = subMap;
        map[master.id].totalLabourCount = Object.values(subMap).reduce((s, v) => s + v, 0);
    }

    await workRef.update({
        labourDetails: map,
        updatedAt: now()
    });

    const updated = await workRef.get();
    const finalData = { workId: updated.id, ...updated.data() };
    finalData.labourDetails = await buildLabourDetails(finalData.labourDetails);

    return finalData;
};

/**
 * Updates ONLY the sub-labour counts for a specific work log.
 * Merges with existing sub-labour details.
 */
exports.updateSubLabourForWork = async (projectNo, workId, labourId, subLabourDetails) => {
    const workRef = worksCollection.doc(workId);
    const workDoc = await workRef.get();
    if (!workDoc.exists) throw new Error("Work log not found");

    const docData = workDoc.data();
    if (docData.projectNo !== projectNo) {
        throw new Error(`Work '${workId}' does not belong to project '${projectNo}'`);
    }

    let map = docData.labourDetails || {};
    if (map.headLabourId && typeof map.headLabourId === 'string') {
        map = { [map.headLabourId]: map };
    }

    if (!map[labourId]) {
        throw new Error(`Head Labour ID '${labourId}' is not assigned to this work entry. Please assign them first.`);
    }

    const entry = map[labourId];
    const incomingSubMap = {};
    if (subLabourDetails && typeof subLabourDetails === 'object') {
        for (const [key, val] of Object.entries(subLabourDetails)) {
            incomingSubMap[key.trim().toUpperCase()] = Number(val) || 0;
        }
    }

    const finalSubMap = { ...(entry.subLabourDetails || {}), ...incomingSubMap };

    map[labourId].subLabourDetails = finalSubMap;
    map[labourId].totalLabourCount = Object.values(finalSubMap).reduce((sum, val) => sum + val, 0);

    await workRef.update({
        labourDetails: map,
        updatedAt: now()
    });

    const updated = await workRef.get();
    const finalData = { workId: updated.id, ...updated.data() };
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

// Date parsing helper to handle arbitrary YYYY-MM-DD or DD-MM-YYYY formats.
const _parseD = (dString) => {
    if (!dString) return null;
    const parts = String(dString).split("T")[0].split("-");
    if (parts.length === 3) {
        if (parts[0].length === 4) return dayjs(`${parts[0]}-${parts[1]}-${parts[2]}`);
        if (parts[2].length === 4) return dayjs(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    return dayjs(dString);
};

// Generates both forward and inverse date string formats for Firestore querying.
const _generateDateVariations = (fromStr, toStr) => {
    const fromD = _parseD(fromStr);
    let toD = _parseD(toStr) || fromD;

    if (!fromD || !fromD.isValid()) return [];

    let current = fromD;
    const vars = new Set();
    while (current.isBefore(toD, 'day') || current.isSame(toD, 'day')) {
        vars.add(current.format("YYYY-MM-DD"));
        vars.add(current.format("DD-MM-YYYY"));
        current = current.add(1, 'day');
        if (vars.size > 28) break; // ensure we stay safely under Firestore's 30 limit for 'in'
    }
    return Array.from(vars);
};

/**
 * Get work documents for a specific project + date.
 * Fully enriched with sub-labour arrays recursively.
 */
exports.getWorkByDate = async (projectNo, date) => {
    const variations = _generateDateVariations(date, date);
    if (variations.length === 0) return [];

    const snapshot = await worksCollection
        .where("projectNo", "==", projectNo)
        .where("date", "in", variations)
        .get();

    if (snapshot.empty) return [];

    const works = snapshot.docs.map(doc => ({ workId: doc.id, ...doc.data() }));

    // Enrich missing manual fields
    for (let i = 0; i < works.length; i++) {
        works[i].labourDetails = await buildLabourDetails(works[i].labourDetails);
    }
    return works;
};

exports.getWorksByWeek = async (projectNo, from, to) => {
    const fromDay = _parseD(from);
    const toDay = _parseD(to);

    // In case the date gap is wildly huge and exceeds 30 variations, filter safely in-memory.
    const snapshot = await worksCollection
        .where("projectNo", "==", projectNo)
        .get();

    if (snapshot.empty) return [];

    const works = [];
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const workDay = _parseD(data.date);
        if (workDay && workDay.isValid() &&
            (workDay.isSame(fromDay, 'day') || workDay.isAfter(fromDay, 'day')) &&
            (workDay.isSame(toDay, 'day') || workDay.isBefore(toDay, 'day'))) {
            works.push({ workId: doc.id, ...data });
        }
    });

    works.sort((a, b) => _parseD(a.date).valueOf() - _parseD(b.date).valueOf());

    // Enrich missing manual fields
    for (let i = 0; i < works.length; i++) {
        works[i].labourDetails = await buildLabourDetails(works[i].labourDetails);
    }
    return works;
};
// ═══════════════════════════════════════════════════════════════════════════
// EDIT ONE SUB-LABOUR COUNT
// ═══════════════════════════════════════════════════════════════════════════
exports.editSubLabourCount = async (projectNo, workId, labourId, type, count) => {
    const workRef = worksCollection.doc(workId);
    const workDoc = await workRef.get();
    if (!workDoc.exists) throw new Error("Work log not found");

    const docData = workDoc.data();
    if (docData.projectNo !== projectNo) {
        throw new Error(`Work '${workId}' does not belong to project '${projectNo}'`);
    }

    let map = docData.labourDetails || {};
    if (map.headLabourId && typeof map.headLabourId === 'string') {
        map = { [map.headLabourId]: map };
    }

    if (!map[labourId]) {
        throw new Error(`Head Labour ID '${labourId}' is not assigned to this work entry.`);
    }

    const normalizedType = type.trim().toUpperCase();
    const entry = map[labourId];
    const existingSubMap = entry.subLabourDetails || {};

    if (!(normalizedType in existingSubMap)) {
        throw new Error(`Sub-labour type '${normalizedType}' not found for this labour in this work`);
    }

    const updatedSubMap = { ...existingSubMap, [normalizedType]: Number(count) || 0 };
    map[labourId].subLabourDetails = updatedSubMap;
    map[labourId].totalLabourCount = Object.values(updatedSubMap).reduce((sum, val) => sum + val, 0);

    await workRef.update({ labourDetails: map, updatedAt: now() });

    const updated = await workRef.get();
    const finalData = { workId: updated.id, ...updated.data() };
    finalData.labourDetails = await buildLabourDetails(finalData.labourDetails);
    return finalData;
};

// ═══════════════════════════════════════════════════════════════════════════
// DELETE ONE SUB-LABOUR TYPE FROM A WORK
// ═══════════════════════════════════════════════════════════════════════════
exports.deleteSubLabourType = async (projectNo, workId, labourId, type) => {
    const workRef = worksCollection.doc(workId);
    const workDoc = await workRef.get();
    if (!workDoc.exists) throw new Error("Work log not found");

    const docData = workDoc.data();
    if (docData.projectNo !== projectNo) {
        throw new Error(`Work '${workId}' does not belong to project '${projectNo}'`);
    }

    let map = docData.labourDetails || {};
    if (map.headLabourId && typeof map.headLabourId === 'string') {
        map = { [map.headLabourId]: map };
    }

    if (!map[labourId]) {
        throw new Error(`Head Labour ID '${labourId}' is not assigned to this work entry.`);
    }

    const normalizedType = type.trim().toUpperCase();
    const entry = map[labourId];
    const existingSubMap = { ...(entry.subLabourDetails || {}) };

    if (!(normalizedType in existingSubMap)) {
        throw new Error(`Sub-labour type '${normalizedType}' not found for this labour in this work`);
    }

    delete existingSubMap[normalizedType];

    map[labourId].subLabourDetails = existingSubMap;
    map[labourId].totalLabourCount = Object.values(existingSubMap).reduce((sum, val) => sum + val, 0);

    await workRef.update({ labourDetails: map, updatedAt: now() });

    const updated = await workRef.get();
    const finalData = { workId: updated.id, ...updated.data() };
    finalData.labourDetails = await buildLabourDetails(finalData.labourDetails);
    return finalData;
};

// ═══════════════════════════════════════════════════════════════════════════
// WEEK FILTER — Mon to Sat date range
// GET /api/works/project/:projectNo/week?from=16-03-2026&to=21-03-2026
// ═══════════════════════════════════════════════════════════════════════════
// exports.getWorksByWeek = async (projectNo, from, to) => {
//     if (!projectNo || !from || !to) {
//         throw new Error("projectNo, from, and to are required");
//     }

//     const snapshot = await worksCollection
//         .where("projectNo", "==", projectNo)
//         .get();

//     if (snapshot.empty) return [];

//     const fromDay = dayjs(from, "DD-MM-YYYY");
//     const toDay = dayjs(to, "DD-MM-YYYY");

//     const works = snapshot.docs
//         .map(doc => ({ workId: doc.id, ...doc.data() }))
//         .filter(w => {
//             const workDay = dayjs(w.date, "DD-MM-YYYY");
//             return (
//                 workDay.isValid() &&
//                 (workDay.isSame(fromDay) || workDay.isAfter(fromDay)) &&
//                 (workDay.isSame(toDay) || workDay.isBefore(toDay))
//             );
//         })
//         .sort((a, b) =>
//             dayjs(a.date, "DD-MM-YYYY").valueOf() -
//             dayjs(b.date, "DD-MM-YYYY").valueOf()
//         );

//     // Enrich with live labour details
//     for (let i = 0; i < works.length; i++) {
//         works[i].labourDetails = await buildLabourDetails(works[i].labourDetails);
//     }

//     return works;
// };

// ═══════════════════════════════════════════════════════════════════════════
// REVERSE LOOKUP — all works/projects a labour was assigned to
// GET /api/labours/master/:labourId/works
// ═══════════════════════════════════════════════════════════════════════════
exports.getWorksByLabour = async (labourId) => {
    if (!labourId) throw new Error("labourId is required");

    // Fetch master labour to get name for legacy string-based query
    let master = null;
    try {
        master = await labourService.getLabourMasterById(labourId);
    } catch (_) { } // Proceed even if master not found

    let legacyNames = [];
    if (master && master.name) {
        const raw = master.name;
        const lower = raw.toLowerCase();
        const upper = raw.toUpperCase();
        const title = lower.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        legacyNames = Array.from(new Set([raw, lower, upper, title]));
    }

    const queries = [
        worksCollection.where("labourDetails.headLabourId", "==", labourId).get(),
        worksCollection.where(`labourDetails.${labourId}.headLabourId`, "==", labourId).get()
    ];

    // If we have name variations, also search by legacy "labourName"
    if (legacyNames.length > 0) {
        queries.push(worksCollection.where("labourName", "in", legacyNames).get());
    }

    const snapshots = await Promise.all(queries);

    const worksMap = new Map();
    snapshots.forEach(snapshot => {
        if (!snapshot.empty) {
            snapshot.docs.forEach(doc => worksMap.set(doc.id, { workId: doc.id, ...doc.data() }));
        }
    });

    if (worksMap.size === 0) return { projects: [], totalWorks: 0 };

    const works = Array.from(worksMap.values());

    // Enrich missing manual fields
    for (let i = 0; i < works.length; i++) {
        works[i].labourDetails = await buildLabourDetails(works[i].labourDetails);
    }

    // Resolve project names (efficient batch fetch)
    const uniqueProjectNos = [...new Set(works.map(w => w.projectNo))];
    const projectNames = {};
    if (uniqueProjectNos.length > 0) {
        for (let i = 0; i < uniqueProjectNos.length; i += 30) {
            const chunk = uniqueProjectNos.slice(i, i + 30);
            const snap = await db.collection("projects").where("projectNo", "in", chunk).get();
            snap.forEach(doc => {
                projectNames[doc.data().projectNo] = doc.data().projectName;
            });
        }
    }

    // Group by projectNo
    const projectMap = {};
    works.forEach(w => {
        const pNo = w.projectNo;
        if (!projectMap[pNo]) {
            projectMap[pNo] = {
                projectNo: pNo,
                projectName: projectNames[pNo] || pNo, // Attach projectName here!
                works: [],
            };
        }

        // Identify correct entry
        let subLabourDetails = {};
        let totalLabourCount = 0;

        // Since we ran buildLabourDetails, it's a keyed map now
        if (w.labourDetails && w.labourDetails[labourId]) {
            subLabourDetails = w.labourDetails[labourId].subLabourDetails || {};
            totalLabourCount = w.labourDetails[labourId].totalLabourCount || 0;
        } else if (w.labourEntries && Array.isArray(w.labourEntries)) {
            // Handle legacy array "labourEntries" from Flutter app
            w.labourEntries.forEach(entry => {
                const type = (entry.workType || "UNKNOWN").toUpperCase();
                const qty = Number(entry.quantity) || 0;
                subLabourDetails[type] = (subLabourDetails[type] || 0) + qty;
                totalLabourCount += qty;
            });
        }

        // Only include this day if the labour actually participated with count > 0
        if (totalLabourCount > 0) {
            projectMap[pNo].works.push({
                workId: w.workId,
                work: w.work || w.workName,               // Fallback matching general API
                workName: w.work || w.workName,
                projectName: projectNames[pNo] || pNo, // Fallback project name
                date: w.date,
                tomorrowWork: w.tomorrowWork || "",
                subLabourDetails,                      // specific to THIS labour
                totalLabourCount,                      // specific to THIS labour
            });
        }
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

    // Remove any projects that ended up with 0 works after filtering
    const validProjects = projects.filter(p => p.totalWorks > 0);

    return {
        labourId,
        projects: validProjects,
        totalWorks: validProjects.reduce((sum, p) => sum + p.totalWorks, 0),
    };
};