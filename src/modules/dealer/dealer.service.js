const { db } = require("../../config/firebase");

const materialReceivedCollection = db.collection("materialReceived");

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

exports.updateDealerPayment = async (phoneNumber, amountPaid) => {
    if (!phoneNumber || !amountPaid || amountPaid <= 0) {
        throw new Error("Valid phone number and positive amountPaid are required");
    }

    const snapshot = await materialReceivedCollection
        .where("dealerContact", "==", phoneNumber)
        .get();

    if (snapshot.empty) {
        throw new Error("No dealer found with this phone number");
    }

    const bills = [];
    snapshot.forEach(doc => {
        bills.push({ id: doc.id, ref: doc.ref, data: doc.data() });
    });

    // Sort by createdAt (oldest first)
    bills.sort((a, b) => new Date(a.data.createdAt || 0) - new Date(b.data.createdAt || 0));

    // Calculate total pending amount for this dealer
    let totalPendingAmount = 0;
    for (const bill of bills) {
        const totalAmt = Number(bill.data.totalAmount) || 0;
        const currentPaidAmt = Number(bill.data.paidAmount) || 0;
        const pendingAmt = totalAmt - currentPaidAmt;
        
        if (pendingAmt > 0) {
            totalPendingAmount += pendingAmt;
        }
    }

    if (totalPendingAmount <= 0) {
        throw new Error("You have already finished the payment. Payment cancelled.");
    }

    if (amountPaid > totalPendingAmount) {
        throw new Error(`Amount paid (${amountPaid}) exceeds the remaining balance (${totalPendingAmount}). Payment cancelled.`);
    }

    let remainingPaymentToApply = Number(amountPaid);
    const updatedBills = [];

    const batch = db.batch();

    for (const bill of bills) {
        if (remainingPaymentToApply <= 0) break;

        const totalAmt = Number(bill.data.totalAmount) || 0;
        const currentPaidAmt = Number(bill.data.paidAmount) || 0;
        const pendingAmt = totalAmt - currentPaidAmt;

        if (pendingAmt > 0) {
            const amountToApplyToThisBill = Math.min(pendingAmt, remainingPaymentToApply);
            const newPaidAmt = currentPaidAmt + amountToApplyToThisBill;
            
            batch.update(bill.ref, { paidAmount: newPaidAmt });
            remainingPaymentToApply -= amountToApplyToThisBill;
            
            updatedBills.push({
                receiptId: bill.id,
                appliedAmount: amountToApplyToThisBill,
                newTotalPaid: newPaidAmt
            });
        }
    }

    await batch.commit();

    // After updating, recalculate the entire payment summary for this dealer
    let newTotalPayment = 0;
    let newAdvancedPayment = 0;

    // Loop through the original bills and use the updated values if they were just updated
    for (const bill of bills) {
        const totalAmt = Number(bill.data.totalAmount) || 0;
        newTotalPayment += totalAmt;
        
        const updatedBillMatch = updatedBills.find(ub => ub.receiptId === bill.id);
        if (updatedBillMatch) {
            newAdvancedPayment += updatedBillMatch.newTotalPaid;
        } else {
            newAdvancedPayment += (Number(bill.data.paidAmount) || 0);
        }
    }

    const newRemainingAmount = newTotalPayment - newAdvancedPayment;

    return {
        message: "Payment updated successfully",
        paymentSummary: {
            totalPayment: newTotalPayment,
            advancedPayment: newAdvancedPayment,
            remainingAmount: newRemainingAmount < 0 ? 0 : newRemainingAmount
        }
    };
};
