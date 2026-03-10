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
