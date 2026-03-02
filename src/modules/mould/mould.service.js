const { db } = require("../../config/firebase");
const dayjs = require("dayjs");

const MOULD_PURCHASES = "mould_purchases";
const MOULD_RENTALS = "mould_rentals";

const nowIST = () => new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

/**
 * Seed limit reference (to prevent exceeding original quantities)
 */
const SEED_LIMITS = [
    { materialName: "CENTRING SHEET", size: "3'0\" X 2'0\"", maxQuantity: 400 },
    { materialName: "SHEET", size: "3'0\" X 1'6\"", maxQuantity: 250 },
    { materialName: "JOCKEY", size: "2 METER", maxQuantity: 450 },
    { materialName: "SPAN", size: "2.5 METER", maxQuantity: 90 },
    { materialName: "SPAN", size: "3 METER", maxQuantity: 60 },
    { materialName: "COLUMN BOX (L-TYPE)", size: "2'0\" X 1'0\" X 7'0\" HEIGHT", maxQuantity: 1 },
    { materialName: "COLUMN BOX (L-TYPE)", size: "2'0\" X 1'6\" X 7'0\" HEIGHT", maxQuantity: 6 },
    { materialName: "SHOE (ANGLE TYPE)", size: "1'6\" X 9\"", maxQuantity: 17 },
    { materialName: "SHOE (ANGLE TYPE)", size: "2'0\" X 1'0\"", maxQuantity: 1 },
    { materialName: "SHOE (ANGLE TYPE)", size: "2'0\" X 1'6\"", maxQuantity: 5 },
    { materialName: "CUPLOCK", size: "3 METER", maxQuantity: 60 },
    { materialName: "CUPLOCK", size: "2 METER", maxQuantity: 80 },
    { materialName: "LEDGER", size: "2 METER", maxQuantity: 300 },
    { materialName: "LEDGER", size: "1.2 METER", maxQuantity: 180 },
    { materialName: "EARTH BEAM SHEET", size: "4'0\" X 1'6\"", maxQuantity: 60 },
    { materialName: "EARTH BEAM SHEET", size: "5'0\" X 1'6\"", maxQuantity: 50 },
    { materialName: "EARTH BEAM SHEET", size: "6'0\" X 1'6\"", maxQuantity: 60 },
    { materialName: "EARTH BEAM SHEET", size: "7'0\" X 1'6\"", maxQuantity: 20 },
    { materialName: "EARTH BEAM SHEET", size: "8'0\" X 1'6\"", maxQuantity: 20 },
    { materialName: "COLUMN BOX (L-TYPE)", size: "9\" X 9\" X 4'0\" HEIGHT", maxQuantity: 20 },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'0\" X 9\" X 4'0\" HEIGHT", maxQuantity: 15 },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'3\" X 9\" X 4'0\" HEIGHT", maxQuantity: 5 },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'6\" X 9\" X 4'0\" HEIGHT", maxQuantity: 5 },
    { materialName: "COLUMN BOX (L-TYPE)", size: "9\" X 9\" X 7'0\" HEIGHT", maxQuantity: 22 },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'0\" X 9\" X 7'0\" HEIGHT", maxQuantity: 15 },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'3\" X 9\" X 7'0\" HEIGHT", maxQuantity: 5 },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'6\" X 9\" X 7'0\" HEIGHT", maxQuantity: 5 },
    { materialName: "BASE PLATE (SCAFFOLDING)", size: "-", maxQuantity: 20 },
    { materialName: "ADJUSTABLE SHEET", size: "1'6\" X 1'0\"", maxQuantity: 20 },
    { materialName: "ADJUSTABLE SHEET", size: "1'6\" X 1'6\"", maxQuantity: 20 },
    { materialName: "ADJUSTABLE SHEET", size: "1'6\" X 2'0\"", maxQuantity: 20 },
    { materialName: "ADJUSTABLE SHEET", size: "1'6\" X 3'0\"", maxQuantity: 50 },
    { materialName: "EARTH BEAM CLAMP", size: "1'6\" X 9\"", maxQuantity: 200 },
    { materialName: "TOP CLAMP", size: "1'6\" X 9\"", maxQuantity: 50 }
];

/**
 * MOULD PURCHASE MANAGEMENT
 */

exports.createPurchase = async (data) => {
    const { materialName, size, totalQuantity, unitType, rent } = data;
    const now = nowIST();

    // Check if same name + same size already exists → update stock
    const snapshot = await db.collection(MOULD_PURCHASES)
        .where("materialName", "==", materialName)
        .where("size", "==", size)
        .get();

    if (!snapshot.empty) {
        const existingDoc = snapshot.docs[0];
        const existingData = existingDoc.data();

        const currentStock = existingData.stock || {
            totalQuantity: existingData.totalQuantity || 0,
            availableStock: existingData.availableStock || 0,
            usedStock: existingData.usedStock || 0
        };

        // FIX: define seedItem before using it
        const seedItem = SEED_LIMITS.find(
            s => s.materialName === materialName && s.size === size
        );

        if (seedItem) {
            if (currentStock.totalQuantity >= seedItem.maxQuantity) {
                return existingData; // Already at max, skip
            }
            const newTotal = currentStock.totalQuantity + totalQuantity;
            if (newTotal > seedItem.maxQuantity) {
                throw new Error(`Cannot exceed max limit of ${seedItem.maxQuantity} for ${materialName} (${size})`);
            }
        }

        const newTotal = currentStock.totalQuantity + totalQuantity;
        const newAvailable = currentStock.availableStock + totalQuantity;

        await existingDoc.ref.update({
            "stock.totalQuantity": newTotal,
            "stock.availableStock": newAvailable,
            "stock.usedStock": currentStock.usedStock || 0,
            updatedAt: now
        });

        const updated = await existingDoc.ref.get();
        return updated.data();
    }

    // Create new material
    const docRef = db.collection(MOULD_PURCHASES).doc();
    const purchaseData = {
        id: docRef.id,
        materialName,
        size,
        unitType,
        stock: {
            totalQuantity,
            availableStock: totalQuantity,
            usedStock: 0
        },
        rent: {
            rentType: rent?.rentType || "MONTH",
            rentAmount: rent?.rentAmount || 0
        },
        createdAt: now,
        updatedAt: now
    };

    await docRef.set(purchaseData);
    return purchaseData;
};

exports.getAllPurchases = async () => {
    const snapshot = await db.collection(MOULD_PURCHASES).get();
    return snapshot.docs.map(doc => doc.data());
};

exports.getPurchaseById = async (id) => {
    const doc = await db.collection(MOULD_PURCHASES).doc(id).get();
    if (!doc.exists) throw new Error("Purchase item not found");
    return doc.data();
};

exports.updatePurchase = async (id, updates) => {
    const docRef = db.collection(MOULD_PURCHASES).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Purchase item not found");

    const now = nowIST();
    const updatedData = { ...updates, updatedAt: now };
    await docRef.update(updatedData);
    return { ...doc.data(), ...updatedData };
};

exports.deletePurchase = async (id) => {
    const docRef = db.collection(MOULD_PURCHASES).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Purchase item not found");
    await docRef.delete();
};

/**
 * RENTAL MANAGEMENT
 */

exports.createRental = async (data) => {
    const { clientName, startDate, endDate, items } = data;
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const usedDays = Math.max(1, end.diff(start, "day") + 1);
    const daysInMonth = start.daysInMonth();
    const now = nowIST();

    let totalMonthlyRent = 0;
    let totalUsedRent = 0;
    const updatedItems = [];

    for (const item of items) {
        const purchaseRef = db.collection(MOULD_PURCHASES).doc(item.materialId);
        const purchaseDoc = await purchaseRef.get();
        if (!purchaseDoc.exists) throw new Error(`Purchase item ${item.materialId} not found`);

        const purchaseData = purchaseDoc.data();
        const stock = purchaseData.stock || {
            availableStock: purchaseData.availableStock || 0,
            usedStock: purchaseData.usedStock || 0
        };

        if (stock.availableStock < item.quantity) {
            throw new Error(`Insufficient stock for ${purchaseData.materialName}. Available: ${stock.availableStock}`);
        }

        const dailyRent = purchaseData.rent?.rentAmount || 0;
        const perItemRent = dailyRent * item.quantity;

        const itemMonthlyTotal = perItemRent * daysInMonth;
        const itemUsedRent = perItemRent * usedDays;

        totalMonthlyRent += itemMonthlyTotal;
        totalUsedRent += itemUsedRent;

        await purchaseRef.update({
            "stock.availableStock": stock.availableStock - item.quantity,
            "stock.usedStock": stock.usedStock + item.quantity,
            updatedAt: now
        });

        updatedItems.push({
            materialId: item.materialId,
            materialName: purchaseData.materialName,
            size: purchaseData.size,
            unitType: purchaseData.unitType,
            quantity: item.quantity,
            rent: {
                totalrentAmount: perItemRent
            },
            peritemRent: dailyRent
        });
    }

    const paid = Math.round(totalMonthlyRent);
    const balance = paid - Math.round(totalUsedRent);

    const docRef = db.collection(MOULD_RENTALS).doc();
    const rentalData = {
        id: docRef.id,
        clientName,
        rentalPeriod: {
            startDate,
            endDate,
            usedDays,
            daysInMonth
        },
        rentSummary: {
            monthlyTotal: Math.round(totalMonthlyRent),
            usedRent: Math.round(totalUsedRent),
            paid: paid,
            balance: balance
        },
        items: updatedItems,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now
    };

    await docRef.set(rentalData);

    // Return the response structured specifically as requested:
    return rentalData;
};


exports.getAllRentals = async () => {
    const snapshot = await db.collection(MOULD_RENTALS).get();
    return snapshot.docs.map(doc => {
        const d = doc.data();
        return {
            id: d.id,
            clientName: d.clientName || d.customerName,
            status: d.status,
            rentalPeriod: d.rentalPeriod,
            payment: {
                pendingAmount: d.payment?.pendingAmount ?? d.pendingAmount ?? 0
            }
        };
    });
};

exports.getRentalById = async (id) => {
    const doc = await db.collection(MOULD_RENTALS).doc(id).get();
    if (!doc.exists) throw new Error("Rental record not found");
    return doc.data();
};

/**
 * Add Payment or Update Rental (PUT /rental/:id)
 * FIX: Sum from paymentHistory to avoid stale payment object bug
 */
exports.updateRental = async (id, body) => {
    const docRef = db.collection(MOULD_RENTALS).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Rental record not found");

    const rental = doc.data();
    const now = nowIST();

    // If endDate is being updated, recalculate rentSummary
    if (body.endDate !== undefined) {
        const startDate = rental.rentalPeriod?.startDate || rental.startDate;
        const endDate = body.endDate;
        const start = dayjs(startDate);
        const end = dayjs(endDate);
        const usedDays = Math.max(1, end.diff(start, "day") + 1);
        const daysInMonth = start.daysInMonth();

        let totalMonthlyRent = 0;
        let totalUsedRent = 0;

        for (const item of rental.items || []) {
            const perItemRent = (item.rent?.totalrentAmount) || 0;
            totalMonthlyRent += perItemRent * daysInMonth;
            totalUsedRent += perItemRent * usedDays;
        }

        const paid = Math.round(totalMonthlyRent);
        const balance = paid - Math.round(totalUsedRent);

        const updatedData = {
            "rentalPeriod.endDate": endDate,
            "rentalPeriod.usedDays": usedDays,
            "rentalPeriod.daysInMonth": daysInMonth,
            rentSummary: {
                monthlyTotal: paid,
                usedRent: Math.round(totalUsedRent),
                paid,
                balance
            },
            updatedAt: now
        };

        // Carry over any other fields from body (excluding endDate which we already handled)
        const { endDate: _ignored, ...otherFields } = body;
        Object.assign(updatedData, Object.fromEntries(
            Object.entries(otherFields).map(([k, v]) => [k, v])
        ));

        await docRef.update(updatedData);
        return { ...rental, ...updatedData };
    }

    if (body.addPayment !== undefined) {
        const addAmt = Number(body.addPayment);

        // Support both old flat & new nested format
        const totalCalculatedRent = rental.rentSummary?.monthlyTotal ??
            rental.calculation?.totalCalculatedRent ??
            rental.calculation?.totalUsedAmount ??
            rental.totalCalculatedRent ?? 0;

        // FIX: Sum fresh from paymentHistory (avoids stale payment.totalPaidAmount bug)
        const existingHistory = rental.paymentHistory || [];
        const historyTotal = existingHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const newTotalPaid = historyTotal + addAmt;
        const newPending = Math.max(0, totalCalculatedRent - newTotalPaid);
        const newBalance = Math.max(0, newTotalPaid - totalCalculatedRent);

        const updatedHistory = [
            ...existingHistory,
            { amount: addAmt, date: now, note: body.note || "Payment Added" }
        ];

        const updatedPayment = {
            initialPayment: rental.payment?.initialPayment ?? rental.initialPayment ?? 0,
            totalPaidAmount: newTotalPaid,
            pendingAmount: newPending,
            balance: newBalance
        };

        await docRef.update({
            payment: updatedPayment,
            totalCalculatedRent: totalCalculatedRent,
            totalPaidAmount: newTotalPaid,
            pendingAmount: newPending,
            balance: newBalance,
            paymentHistory: updatedHistory,
            updatedAt: now
        });

        return {
            totalCalculatedRent: totalCalculatedRent,
            totalPaidAmount: newTotalPaid,
            pendingAmount: newPending,
            balance: newBalance,
            paymentHistory: updatedHistory
        };
    }

    // Generic update
    const updatedData = { ...body, updatedAt: now };
    await docRef.update(updatedData);
    return { ...rental, ...updatedData };
};


exports.deleteRental = async (id) => {
    const docRef = db.collection(MOULD_RENTALS).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Rental record not found");

    const rental = doc.data();
    const now = nowIST();

    for (const item of rental.items) {
        const purchaseRef = db.collection(MOULD_PURCHASES).doc(item.materialId);
        const purchaseDoc = await purchaseRef.get();
        if (purchaseDoc.exists) {
            const pd = purchaseDoc.data();
            const stock = pd.stock || { availableStock: pd.availableStock || 0, usedStock: pd.usedStock || 0 };
            await purchaseRef.update({
                "stock.availableStock": (stock.availableStock || 0) + item.quantity,
                "stock.usedStock": Math.max(0, (stock.usedStock || 0) - item.quantity),
                updatedAt: now
            });
        }
    }

    await docRef.delete();
};

exports.paymentUpdate = async (id, body) => {
    const { balance: payAmount, note } = body;
    const docRef = db.collection(MOULD_RENTALS).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Rental record not found");

    const rental = doc.data();
    const now = nowIST();

    const currentBalance = rental.rentSummary?.balance ?? 0;

    if (payAmount > currentBalance) {
        const err = new Error(`Payment amount (${payAmount}) exceeds current balance (${currentBalance})`);
        err.statusCode = 400;
        throw err;
    }

    const newBalance = Math.round(currentBalance - payAmount);

    const existingHistory = rental.paymentHistory || [];
    const updatedHistory = [
        ...existingHistory,
        { amount: payAmount, note: note || "Payment", date: now }
    ];

    const updatedRentSummary = {
        ...rental.rentSummary,
        balance: newBalance
    };

    const newStatus = newBalance === 0 ? "COMPLETED" : rental.status;

    await docRef.update({
        rentSummary: updatedRentSummary,
        paymentHistory: updatedHistory,
        status: newStatus,
        updatedAt: now
    });

    return { status: "Payment successfully completed" };
};

exports.addPayment = async (rentalId, paymentInfo) => {
    const { amount, date, note } = paymentInfo;
    const docRef = db.collection(MOULD_RENTALS).doc(rentalId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Rental record not found");

    const rental = doc.data();
    const now = nowIST();

    const totalCalculatedRent = rental.calculation?.totalCalculatedRent ??
        rental.calculation?.totalUsedAmount ??
        rental.totalCalculatedRent ??
        rental.totalUsedAmount ??
        0;
    const existingHistory = rental.paymentHistory || [];
    const historyTotal = existingHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const newTotalPaid = historyTotal + amount;
    const newPending = Math.max(0, totalCalculatedRent - newTotalPaid);
    const newBalance = Math.max(0, newTotalPaid - totalCalculatedRent);

    const updatedPayment = {
        initialPayment: rental.payment?.initialPayment ?? rental.initialPayment ?? 0,
        totalPaidAmount: newTotalPaid,
        pendingAmount: newPending,
        balance: newBalance
    };

    const updatedHistory = [
        ...existingHistory,
        { amount, date: date || now, note }
    ];

    await docRef.update({
        payment: updatedPayment,
        totalCalculatedRent: totalCalculatedRent,
        totalPaidAmount: newTotalPaid,
        pendingAmount: newPending,
        balance: newBalance,
        paymentHistory: updatedHistory,
        updatedAt: now
    });

    return {
        ...rental,
        payment: updatedPayment,
        totalCalculatedRent: totalCalculatedRent,
        totalPaidAmount: newTotalPaid,
        pendingAmount: newPending,
        balance: newBalance,
        paymentHistory: updatedHistory
    };
};

exports.closeRental = async (rentalId) => {
    const docRef = db.collection(MOULD_RENTALS).doc(rentalId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Rental record not found");

    const rental = doc.data();
    const now = nowIST();

    for (const item of rental.items) {
        const purchaseRef = db.collection(MOULD_PURCHASES).doc(item.materialId);
        const purchaseDoc = await purchaseRef.get();
        if (purchaseDoc.exists) {
            const pd = purchaseDoc.data();
            const stock = pd.stock || { availableStock: pd.availableStock || 0, usedStock: pd.usedStock || 0 };
            await purchaseRef.update({
                "stock.availableStock": (stock.availableStock || 0) + item.quantity,
                "stock.usedStock": Math.max(0, (stock.usedStock || 0) - item.quantity),
                updatedAt: now
            });
        }
    }

    await docRef.update({ status: "COMPLETED", updatedAt: now });
};

exports.getClientMaterialHistory = async (clientName, materialId) => {
    const snapshot = await db.collection(MOULD_RENTALS)
        .where("clientName", "==", clientName)
        .get();

    const history = [];
    snapshot.docs.forEach(doc => {
        const rental = doc.data();
        const matchedItems = rental.items.filter(i => i.materialId === materialId);
        if (matchedItems.length > 0) {
            history.push({
                rentalId: rental.id,
                rentalPeriod: rental.rentalPeriod,
                status: rental.status,
                payment: rental.payment,
                items: matchedItems,
                createdAt: rental.createdAt
            });
        }
    });

    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return history;
};

exports.calculateRental = async (data) => {
    const { clientName, startDate, endDate, initialPayment, items } = data;
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const totalDays = Math.max(1, end.diff(start, "day") + 1);

    let totalRentalAmount = 0;
    const materials = [];

    for (const item of items) {
        const purchaseRef = db.collection(MOULD_PURCHASES).doc(item.materialId);
        const purchaseDoc = await purchaseRef.get();
        if (!purchaseDoc.exists) throw new Error(`Material with ID ${item.materialId} not found`);

        const purchaseData = purchaseDoc.data();
        const dailyRent = purchaseData.rent?.rentAmount || 0;
        const totalItemRent = dailyRent * item.quantity * totalDays;

        totalRentalAmount += totalItemRent;

        materials.push({
            materialId: item.materialId,
            materialName: purchaseData.materialName,
            size: purchaseData.size,
            unitType: purchaseData.unitType,
            quantity: item.quantity,
            dailyRent,
            totalItemRent
        });
    }

    const diff = totalRentalAmount - initialPayment;
    const pendingAmount = Math.max(0, diff);
    const balance = Math.max(0, -diff);

    let status = "NO_BALANCE";
    if (pendingAmount > 0) status = "PAYABLE";
    else if (balance > 0) status = "REFUND";

    return {
        clientName,
        rentalPeriod: {
            startDate,
            endDate,
            totalDays
        },
        materials,
        calculation: {
            initialPayment,
            totalRentalAmount,
            pendingAmount,
            balance,
            status
        }
    };
};
