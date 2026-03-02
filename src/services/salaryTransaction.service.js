const { db } = require('../config/firebase');
const admin = require('firebase-admin');

const COL_EMPLOYEES = 'users';
const COL_ATTENDANCE = 'attendance';   // sub-collection: attendance/{empID}/{year-month}/{dayDocs}
const COL_TRANSACTIONS = 'salaryTransactions';


// ─────────────────────────────────────────────────────────
// HELPER: Calculate total salary from attendance record
// ─────────────────────────────────────────────────────────
const calcTotalSalary = (attendance, salaryPerDay) => {
    const present = Number(attendance.presentDays || 0);
    const half = Number(attendance.halfDays || 0);
    const absent = Number(attendance.absentDays || 0);
    const paidLeave = Number(attendance.paidLeaveDays || 0);
    const spd = Number(salaryPerDay || 0);

    // Formula:
    //   Present    = full salary
    //   Half day   = 50%
    //   Paid Leave = full salary
    //   Absent     = ₹0
    return (present * spd) + (half * spd * 0.5) + (paidLeave * spd);
};

// ─────────────────────────────────────────────────────────
// HELPER: Get all transactions for an employee & calculate
//         total advances, total payments, remaining balance
// ─────────────────────────────────────────────────────────
const getTransactionSummary = async (empID, totalSalary) => {
    const snap = await db.collection(COL_TRANSACTIONS)
        .where('empID', '==', empID)
        .get();

    const transactions = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    let advancesTaken = 0;
    let payments = 0;

    transactions.forEach(txn => {
        if (txn.type === 'Advance') advancesTaken += Number(txn.amount || 0);
        if (txn.type === 'Payment') payments += Number(txn.amount || 0);
    });

    const remainingBalance = totalSalary - advancesTaken - payments;

    return { transactions, advancesTaken, payments, remainingBalance };
};


// ═══════════════════════════════════════════════════════════
// 1. GET SALARY SUMMARY
//    month: "3" (March), year: "2026"
// ═══════════════════════════════════════════════════════════
exports.getSalarySummary = async (empID, month, year) => {
    // Use current month/year as default
    const now = new Date();
    const m = String(month || now.getMonth() + 1).padStart(2, '0');
    const y = String(year || now.getFullYear());
    const subCollectionKey = `${y}-${m}`;   // e.g. "2026-03"

    // 1. Get employee
    const empSnap = await db.collection(COL_EMPLOYEES)
        .where('empID', '==', empID)
        .limit(1)
        .get();

    if (empSnap.empty) throw Object.assign(new Error(`Employee "${empID}" not found.`), { code: 'EMP_NOT_FOUND' });

    const employee = empSnap.docs[0].data();
    const salaryPerDay = Number(employee.salaryPerDay || 0);
    const hourlyRate = salaryPerDay / 8;

    // 2. Read attendance sub-collection: attendance/{empID}/{year-month}
    const attSnap = await db.collection(COL_ATTENDANCE)
        .doc(empID)
        .collection(subCollectionKey)
        .get();

    // 3. Calculate attendance breakdown from day-level docs
    let presentDays = 0, halfDays = 0, absentDays = 0, paidLeaveDays = 0;
    let totalSalary = 0;

    // 3. Count attendance using the pre-calculated "status" field stored by attendance service
    //    Stored values: "Present" | "Half Day" | "Absent" | "Paid Leave"  (case-insensitive)
    attSnap.docs.forEach(doc => {
        const data = doc.data();
        const status = (data.status || '').toLowerCase().trim();

        if (status === 'present') {
            presentDays++;
            totalSalary += salaryPerDay;
        } else if (status === 'half day' || status === 'half') {
            halfDays++;
            totalSalary += salaryPerDay * 0.5;
        } else if (status === 'paid leave') {
            paidLeaveDays++;
            totalSalary += salaryPerDay;
        } else {
            // absent / empty / anything else
            absentDays++;
        }
    });


    // 4. Get transactions & remaining balance
    const { transactions, advancesTaken, remainingBalance } = await getTransactionSummary(empID, totalSalary);

    return {
        month: m, year: y,
        totalSalary: Number(totalSalary.toFixed(2)),
        advancesTaken: Number(advancesTaken.toFixed(2)),
        remainingBalance: Number(remainingBalance.toFixed(2)),
        attendanceBreakdown: {
            presentDays, halfDays, absentDays, paidLeaveDays,
            totalDaysRecorded: attSnap.size,
            salaryPerDay,
            wagesType: employee.wagesType || 'Daily'
        },
        transactions: transactions.map(txn => ({
            id: txn.id,
            date: txn.date,
            type: txn.type,
            amount: Number(txn.amount || 0),
            remark: txn.remark || '',
            balance: Number(txn.balanceAfterTransaction || 0)
        }))
    };
};



// ═══════════════════════════════════════════════════════════
// 2. ADD ADVANCE
//    Validates: amount > 0 & amount <= remainingBalance
// ═══════════════════════════════════════════════════════════
exports.addAdvance = async (empID, amount, remark, month, year) => {
    const advanceAmt = Number(amount || 0);

    if (advanceAmt <= 0) {
        throw Object.assign(new Error('Advance amount must be greater than 0.'), { code: 'INVALID_AMOUNT' });
    }

    // Get current summary to check remaining balance
    const summary = await exports.getSalarySummary(empID, month, year);

    if (advanceAmt > summary.remainingBalance) {
        throw Object.assign(
            new Error(`Advance (₹${advanceAmt}) cannot exceed remaining balance (₹${summary.remainingBalance}).`),
            { code: 'EXCEEDS_BALANCE' }
        );
    }

    const newBalance = summary.remainingBalance - advanceAmt;

    const txnData = {
        empID,
        type: 'Advance',
        amount: advanceAmt,
        remark: remark || 'Advance payment',
        date: new Date().toISOString(),
        balanceAfterTransaction: Number(newBalance.toFixed(2)),
        createdAt: admin.firestore.Timestamp.now()
    };

    const docRef = await db.collection(COL_TRANSACTIONS).add(txnData);

    return {
        id: docRef.id,
        ...txnData,
        previousBalance: summary.remainingBalance,
        newBalance: Number(newBalance.toFixed(2))
    };
};


// ═══════════════════════════════════════════════════════════
// 3. ADD PAYMENT
//    Validates: amount must equal remaining balance
//    Marks salary as fully paid.
// ═══════════════════════════════════════════════════════════
exports.addPayment = async (empID, amount, remark, month, year) => {
    const paymentAmt = Number(amount || 0);

    const summary = await exports.getSalarySummary(empID, month, year);

    if (paymentAmt <= 0) {
        throw Object.assign(new Error('Payment amount must be greater than 0.'), { code: 'INVALID_AMOUNT' });
    }

    if (paymentAmt !== summary.remainingBalance) {
        throw Object.assign(
            new Error(`Payment (₹${paymentAmt}) must equal the remaining balance (₹${summary.remainingBalance}).`),
            { code: 'AMOUNT_MISMATCH' }
        );
    }

    const txnData = {
        empID,
        type: 'Payment',
        amount: paymentAmt,
        remark: remark || 'Full salary payment',
        date: new Date().toISOString(),
        balanceAfterTransaction: 0,   // Fully paid
        salaryClearedAt: new Date().toISOString(),
        status: 'Paid',
        createdAt: admin.firestore.Timestamp.now()
    };

    const docRef = await db.collection(COL_TRANSACTIONS).add(txnData);

    return {
        id: docRef.id,
        ...txnData,
        previousBalance: summary.remainingBalance,
        newBalance: 0,
        message: `Salary fully paid for ${empID}. Balance cleared.`
    };
};
