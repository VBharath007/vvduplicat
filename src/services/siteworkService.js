const { db } = require('../config/firebase');
const admin = require('firebase-admin');

// 🟢 CREATE: Comprehensive Daily Report (Materials + Labours + Finance + Planning)
exports.addDailyReport = async (data) => {
    const now = new Date();
    const localDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }); 
    const localTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

    // 1️⃣ AUTOMATIC MATERIAL STOCK REDUCTION & USAGE TRACKING
    if (data.materialsUsed && data.materialsUsed.length > 0) {
        for (const item of data.materialsUsed) {
            // Collection name 'materials' as per your Firestore screenshot
            const materialRef = db.collection('materials').doc(item.materialId);
            const matDoc = await materialRef.get();

            if (matDoc.exists) {
                const matData = matDoc.data();
                
                // Strict Number Conversion: String inputs-ah handle panna Number() use panrom
                const currentStock = Number(matData.currentQuantity || 0);
                const previousTotalUsed = Number(matData.totalUsed || 0);
                const usageAmount = Number(item.quantity || 0);
                
                // Stock Calculations
                const newRemaining = currentStock - usageAmount;
                const newTotalUsed = previousTotalUsed + usageAmount;

                // Update Material Master Table
                await materialRef.update({
                    currentQuantity: newRemaining, // Inga stock korayudhu
                    totalUsed: newTotalUsed,      // Inga total usage yerudhu
                    updatedAt: `${localDate} | ${localTime}`
                });

                // Audit Log in Ledger: Evidence-kaaga tracking entry
                await db.collection('material_ledger').add({
                    materialId: item.materialId,
                    type: "SITE_USAGE",
                    quantityUsed: usageAmount,
                    remainingStock: newRemaining,
                    projectName: data.projectName || "General Site",
                    dateTime: `${localDate} | ${localTime}`,
                    timestamp: admin.firestore.Timestamp.now()
                });

                console.log(`✅ Updated ${item.materialId}: Stock ${newRemaining}, Used ${newTotalUsed}`);
            } else {
                console.error(`❌ Material ID ${item.materialId} not found!`);
            }
        }
    }

    // 2️⃣ CALCULATE LABOUR TOTALS
    const maleCount = Number(data.labourDetails?.male || 0);
    const femaleCount = Number(data.labourDetails?.female || 0);
    const totalLabours = maleCount + femaleCount;

    // 3️⃣ PREPARE FINAL REPORT OBJECT
    const reportData = {
        projectId: data.projectId,
        projectName: data.projectName,
        date: data.date || localDate,

        // Labour Information
        labourDetails: {
            male: maleCount,
            female: femaleCount,
            total: totalLabours
        },

        // Financials (Petty Cash)
        pettyCashExpenses: Number(data.pettyCashExpenses || 0),
        expenseRemarks: data.expenseRemarks || "",

        // Work Progress Details
        workDetails: {
            todayWork: data.workDetails?.todayWork || "",
            pendingWork: data.workDetails?.pendingWork || "",
            tomorrowPlan: data.workDetails?.tomorrowPlan || ""
        },

        // Manual Remainders / Notes
        remainder: data.remainder || "",

        // Materials Used Snapshot
        materialsUsed: data.materialsUsed || [],

        // Entry Metadata
        entryDetails: {
            submittedAt: `${localDate} | ${localTime}`,
            timestamp: admin.firestore.Timestamp.now()
        }
    };

    // Save report to 'siteworks' collection
    const docRef = await db.collection('siteworks').add(reportData);

    // 4️⃣ UPDATE MASTER PROJECT STATUS
    if (data.projectId) {
        const status = data.workDetails?.todayWork || "Progress Updated";
        await db.collection('projects').doc(data.projectId).update({
            "currentStatus": status, 
            "lastUpdateLocal": `${localDate} ${localTime}`
        }).catch((err) => console.log("Master update skipped:", err.message));
    }

    return { id: docRef.id, ...reportData };
};

// 🔵 READ: History with Manual Sorting
exports.getProjectHistory = async (projectId) => {
    const snapshot = await db.collection('siteworks')
        .where('projectId', '==', projectId)
        .get();
    
    let history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    history.sort((a, b) => {
        const timeA = a.entryDetails?.timestamp?.toMillis() || 0;
        const timeB = b.entryDetails?.timestamp?.toMillis() || 0;
        return timeB - timeA;
    });

    return history;
};

// 🟡 UPDATE: Edit entry
exports.updateReport = async (id, data) => {
    await db.collection('siteworks').doc(id).update({
        ...data,
        updatedAt: admin.firestore.Timestamp.now()
    });
    return { id, message: "Report updated successfully" };
};

// 🔴 DELETE: Remove entry
exports.deleteReport = async (id) => {
    await db.collection('siteworks').doc(id).delete();
    return { message: "Report deleted from database" };
};