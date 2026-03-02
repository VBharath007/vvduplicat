const { db } = require("../config/firebase");
const USERS = "users";
const SALARIES = "salaries";
const ATTENDANCE = "attendance";

/* ====================================
   Calculate Salary for an Employee
==================================== */
exports.calculateSalary = async (empID, month, year) => {

    const userSnapshot = await db.collection(USERS)
        .where("empID", "==", empID)
        .get();

    if (userSnapshot.empty) throw new Error("Employee not found");

    const user = userSnapshot.docs[0].data();
    const salaryPerDay = user.salaryPerDay;
    const hourlyRate = salaryPerDay / 8;

    const attendanceSnapshot = await db.collection(ATTENDANCE)
        .doc(empID)
        .collection(`${year}-${month}`)
        .get();

    let totalSalary = 0;
    let totalHoursWorked = 0;
    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;

    attendanceSnapshot.docs.forEach(doc => {
        const data = doc.data();

        if (!data.startTime || !data.endTime) {
            absentDays++;
            return;
        }

        const start = data.startTime.toDate();
        const end = data.endTime.toDate();

        const hoursWorked = (end - start) / (1000 * 60 * 60);
        totalHoursWorked += hoursWorked;

        if (hoursWorked >= 8) {
            presentDays++;
            totalSalary += salaryPerDay;

            // Extra hour increment
            if (hoursWorked > 8) {
                const extraHours = hoursWorked - 8;
                totalSalary += extraHours * hourlyRate;
            }

        } else if (hoursWorked >= 4) {
            halfDays++;
            totalSalary += salaryPerDay / 2;
        } else {
            absentDays++;
        }
    });

    return {
        empID,
        name: user.name,
        month,
        year,
        presentDays,
        halfDays,
        absentDays,
        totalHoursWorked: Number(totalHoursWorked.toFixed(2)),
        totalSalary: Number(totalSalary.toFixed(2))
    };
};


/* ====================================
   Generate Monthly Salary
==================================== */
exports.generateMonthlySalary = async (month, year) => {
    const employeesSnapshot = await db.collection(USERS)
        .where("role", "==", "employee")
        .get();

    const salaries = [];

    for (const doc of employeesSnapshot.docs) {
        const emp = doc.data();
        const salary = await exports.calculateSalary(emp.empID, month, year);

        // Save to Firestore
        await db.collection(SALARIES).add({
            empID: emp.empID,
            month,
            year,
            totalSalary: salary.totalSalary,
            presentDays: salary.presentDays,
            halfDays: salary.halfDays,
            generatedAt: new Date()
        });

        salaries.push(salary);
    }

    return salaries;
};


exports.createSalary = async (req, res) => {
    try {
        const salary = req.body;

        await db.collection(SALARIES).add({
            ...salary,
            createdAt: new Date()
        });

        res.json({ message: "Salary created successfully" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


exports.updateSalary = async (req, res) => {
    try {
        const { id } = req.params;

        await db.collection(SALARIES).doc(id).update(req.body);

        res.json({ message: "Salary updated successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteSalary = async (req, res) => {
    try {
        const { id } = req.params;

        await db.collection(SALARIES).doc(id).delete();

        res.json({ message: "Salary deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ============================================================
// ADVANCE SALARY FUNCTIONS
// ============================================================
const ADVANCE_SALARIES = "advance_salaries";

/* ================================================
   1. GIVE ADVANCE SALARY
   Records an advance given to employee.
   auto-calculates remaining salary.
================================================ */
exports.giveAdvanceSalary = async (data) => {
    const { empID, advanceAmount, month, year, reason } = data;

    // Validate employee
    const userSnap = await db.collection(USERS).where("empID", "==", empID).limit(1).get();
    if (userSnap.empty) throw new Error(`Employee "${empID}" not found.`);

    const employee = userSnap.docs[0].data();
    const monthlySalary = Number(employee.monthlySalary || employee.salaryPerDay * 26 || 0);
    const advanceAmt = Number(advanceAmount || 0);

    // Check total advances already given this month
    const existingSnap = await db.collection(ADVANCE_SALARIES)
        .where("empID", "==", empID)
        .where("month", "==", month)
        .where("year", "==", year)
        .get();

    const totalAlreadyAdvanced = existingSnap.docs.reduce((sum, doc) => sum + Number(doc.data().advanceAmount || 0), 0);
    const totalAfterThis = totalAlreadyAdvanced + advanceAmt;

    if (totalAfterThis > monthlySalary) {
        throw Object.assign(
            new Error(`Total advance (₹${totalAfterThis}) would exceed monthly salary (₹${monthlySalary}). Already given: ₹${totalAlreadyAdvanced}`),
            { code: "ADVANCE_EXCEEDS_SALARY" }
        );
    }

    const advanceRecord = {
        empID,
        employeeName: employee.name || "N/A",
        advanceAmount: advanceAmt,
        month,
        year,
        reason: reason || "Not specified",
        monthlySalary,
        totalAdvancedSoFar: totalAfterThis,
        remainingSalary: monthlySalary - totalAfterThis,   // monthlySalary - advanceSalary
        givenAt: new Date().toISOString(),
        status: "Active"
    };

    const docRef = await db.collection(ADVANCE_SALARIES).add(advanceRecord);
    return { id: docRef.id, ...advanceRecord };
};


/* ================================================
   2. GET ADVANCE HISTORY (by empID)
   Returns all advances + running summary.
================================================ */
exports.getAdvanceHistory = async (empID, month, year) => {
    let query = db.collection(ADVANCE_SALARIES).where("empID", "==", empID);
    if (month) query = query.where("month", "==", month);
    if (year) query = query.where("year", "==", year);

    const snap = await query.get();
    const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    records.sort((a, b) => new Date(b.givenAt) - new Date(a.givenAt));

    const totalAdvanced = records.reduce((sum, r) => sum + Number(r.advanceAmount || 0), 0);
    const monthlySalary = records[0]?.monthlySalary || 0;
    const remainingSalary = monthlySalary - totalAdvanced;

    return { empID, monthlySalary, totalAdvanced, remainingSalary, records };
};


/* ================================================
   3. SETTLE FINAL SALARY
   finalSalary = monthlySalary - totalAdvances
   Saves settlement & marks advances as "Settled".
================================================ */
exports.settleFinalSalary = async (empID, month, year) => {
    const userSnap = await db.collection(USERS).where("empID", "==", empID).limit(1).get();
    if (userSnap.empty) throw new Error(`Employee "${empID}" not found.`);

    const employee = userSnap.docs[0].data();
    const monthlySalary = Number(employee.monthlySalary || employee.salaryPerDay * 26 || 0);

    const advSnap = await db.collection(ADVANCE_SALARIES)
        .where("empID", "==", empID)
        .where("month", "==", month)
        .where("year", "==", year)
        .get();

    const totalAdvanced = advSnap.docs.reduce((sum, doc) => sum + Number(doc.data().advanceAmount || 0), 0);
    const finalSalary = monthlySalary - totalAdvanced;

    const settlement = {
        empID,
        employeeName: employee.name || "N/A",
        month, year,
        monthlySalary,
        totalAdvanced,
        finalSalary,       // ← Amount actually paid on salary day
        settledAt: new Date().toISOString(),
        type: "FINAL_SETTLEMENT"
    };

    const docRef = await db.collection(SALARIES).add(settlement);

    // Mark all advance records as Settled
    const batch = db.batch();
    advSnap.docs.forEach(doc => batch.update(doc.ref, { status: "Settled" }));
    await batch.commit();

    return { id: docRef.id, ...settlement };
};
