const { db } = require("../../config/firebase");

const materialReceivedCollection = db.collection("materialReceived");
const paymentsCollection = db.collection("dealerPayments");

exports.getDealerHistory = async (phoneNumber) => {
    if (!phoneNumber) {
        throw new Error("Phone number is required");
    }

    const snapshot = await materialReceivedCollection.where("dealerContact", "==", phoneNumber).get();

    if (snapshot.empty) {
        throw new Error("No dealer found with this phone number");
    }

    let dealerName = "";
    const history = [];
    let totalPayment = 0;
    let advancedPayment = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        if (!dealerName && data.dealerName) {
            dealerName = data.dealerName;
        }

        const totalAmt = Number(data.totalAmount) || 0;
        const paidAmt = Number(data.paidAmount) || 0;
        const remAmt = totalAmt - paidAmt;

        history.push({
            projectNo: data.projectNo,
            materialId: data.materialId,
            materialName: data.materialName,
            unit: data.unit,
            rate: data.rate,
            quantity: data.quantity,
            totalAmount: totalAmt,
            paidAmount: paidAmt,
            remainingAmount: remAmt,
            createdAt: data.createdAt
        });

        totalPayment += totalAmt;
        advancedPayment += paidAmt;
    });

    const remainingAmountGlobal = totalPayment - advancedPayment;

    return {
        dealerDetails: {
            dealerName,
            phoneNumber
        },
        materialHistory: history,
        paymentSummary: {
            totalPayment,
            advancedPayment,
            remainingAmount: remainingAmountGlobal
        }
    };
};

exports.getDealerPaymentHistory = async (phoneNumber) => {
    if (!phoneNumber) {
        throw new Error("Phone number is required");
    }

    const snapshot = await materialReceivedCollection.where("dealerContact", "==", phoneNumber).get();

    if (snapshot.empty) {
        throw new Error("No transactions found for this dealer phone number");
    }

    let dealerName = "";
    const paymentHistory = [];
    let totalBilled = 0;
    let totalPaid = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        if (!dealerName && data.dealerName) {
            dealerName = data.dealerName;
        }

        const totalAmt = Number(data.totalAmount) || 0;
        const paidAmt = Number(data.paidAmount) || 0;
        const balance = totalAmt - paidAmt;

        paymentHistory.push({
            receiptId: doc.id,
            projectNo: data.projectNo,
            materialId: data.materialId,
            materialName: data.materialName,
            billDate: data.createdAt,
            totalAmount: totalAmt,
            paidAmount: paidAmt,
            balance: balance,
            status: balance <= 0 ? "Fully Paid" : (paidAmt > 0 ? "Partially Paid" : "Pending")
        });

        totalBilled += totalAmt;
        totalPaid += paidAmt;
    });

    return {
        dealerDetails: {
            dealerName,
            phoneNumber
        },
        paymentHistory,
        summary: {
            totalBilled,
            totalPaid,
            totalBalance: totalBilled - totalPaid
        }
    };
};

exports.getAllDealers = async () => {
    const snapshot = await materialReceivedCollection.get();

    if (snapshot.empty) {
        return [];
    }

    const dealerMap = {};

    snapshot.forEach(doc => {
        const data = doc.data();
        const phone = data.dealerContact;

        if (!phone) return;

        if (!dealerMap[phone]) {
            dealerMap[phone] = {
                dealerName: data.dealerName || "",
                phoneNumber: phone,
                totalPayment: 0,
                advancedPayment: 0,
                remainingAmount: 0,
                transactionCount: 0
            };
        }

        const totalAmt = Number(data.totalAmount) || 0;
        const paidAmt = Number(data.paidAmount) || 0;

        dealerMap[phone].totalPayment += totalAmt;
        dealerMap[phone].advancedPayment += paidAmt;
        dealerMap[phone].remainingAmount += (totalAmt - paidAmt);
        dealerMap[phone].transactionCount += 1;

        // Use the first non-empty dealer name found
        if (!dealerMap[phone].dealerName && data.dealerName) {
            dealerMap[phone].dealerName = data.dealerName;
        }
    });

    return Object.values(dealerMap);
};

// dealer.service.js
// Separate collection

exports.updateDealerPayment = async (phoneNumber, amountPaid) => {
    if (!phoneNumber || !amountPaid || amountPaid <= 0) {
        throw new Error("Valid phone number and positive amountPaid are required");
    }

    const snapshot = await materialReceivedCollection
        .where("dealerContact", "==", phoneNumber)
        .get();

    // 1. Log the transaction in the NEW collection first
    const paymentRef = paymentsCollection.doc();
    await paymentRef.set({
        dealerContact: phoneNumber,
        amountPaid: Number(amountPaid),
        date: new Date().toISOString(),
        type: "Payment"
    });

    // 2. FIFO Logic to clear existing bills (existing logic)
    const bills = [];
    snapshot.forEach(doc => bills.push({ id: doc.id, ref: doc.ref, data: doc.data() }));
    bills.sort((a, b) => new Date(a.data.createdAt || 0) - new Date(b.data.createdAt || 0));

    let remainingPaymentToApply = Number(amountPaid);
    const batch = db.batch();

    for (const bill of bills) {
        if (remainingPaymentToApply <= 0) break;
        const pendingAmt = (Number(bill.data.totalAmount) || 0) - (Number(bill.data.paidAmount) || 0);

        if (pendingAmt > 0) {
            const apply = Math.min(pendingAmt, remainingPaymentToApply);
            batch.update(bill.ref, { paidAmount: (Number(bill.data.paidAmount) || 0) + apply });
            remainingPaymentToApply -= apply;
        }
    }
    await batch.commit();

    return { message: "Payment recorded successfully" };
};
