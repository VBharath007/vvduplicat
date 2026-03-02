const { db } = require("../../../config/firebase");

const MOULD_PURCHASES = "mould_purchases";

const seedData = [
    { materialName: "CENTRING SHEET", size: "3'0\" X 2'0\"", totalQuantity: 400, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "SHEET", size: "3'0\" X 1'6\"", totalQuantity: 250, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "JOCKEY", size: "2 METER", totalQuantity: 450, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "SPAN", size: "2.5 METER", totalQuantity: 90, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "SPAN", size: "3 METER", totalQuantity: 60, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "COLUMN BOX (L-TYPE)", size: "2'0\" X 1'0\" X 7'0\" HEIGHT", totalQuantity: 1, unitType: "SET", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "COLUMN BOX (L-TYPE)", size: "2'0\" X 1'6\" X 7'0\" HEIGHT", totalQuantity: 6, unitType: "SET", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "SHOE (ANGLE TYPE)", size: "1'6\" X 9\"", totalQuantity: 17, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "SHOE (ANGLE TYPE)", size: "2'0\" X 1'0\"", totalQuantity: 1, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "SHOE (ANGLE TYPE)", size: "2'0\" X 1'6\"", totalQuantity: 5, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "CUPLOCK", size: "3 METER", totalQuantity: 60, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "CUPLOCK", size: "2 METER", totalQuantity: 80, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "LEDGER", size: "2 METER", totalQuantity: 300, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "LEDGER", size: "1.2 METER", totalQuantity: 180, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "EARTH BEAM SHEET", size: "4'0\" X 1'6\"", totalQuantity: 60, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "EARTH BEAM SHEET", size: "5'0\" X 1'6\"", totalQuantity: 50, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "EARTH BEAM SHEET", size: "6'0\" X 1'6\"", totalQuantity: 60, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "EARTH BEAM SHEET", size: "7'0\" X 1'6\"", totalQuantity: 20, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "EARTH BEAM SHEET", size: "8'0\" X 1'6\"", totalQuantity: 20, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "COLUMN BOX (L-TYPE)", size: "9\" X 9\" X 4'0\" HEIGHT", totalQuantity: 20, unitType: "SET", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'0\" X 9\" X 4'0\" HEIGHT", totalQuantity: 15, unitType: "SET", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'3\" X 9\" X 4'0\" HEIGHT", totalQuantity: 5, unitType: "SET", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'6\" X 9\" X 4'0\" HEIGHT", totalQuantity: 5, unitType: "SET", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "COLUMN BOX (L-TYPE)", size: "9\" X 9\" X 7'0\" HEIGHT", totalQuantity: 22, unitType: "SET", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'0\" X 9\" X 7'0\" HEIGHT", totalQuantity: 15, unitType: "SET", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'3\" X 9\" X 7'0\" HEIGHT", totalQuantity: 5, unitType: "SET", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "COLUMN BOX (L-TYPE)", size: "1'6\" X 9\" X 7'0\" HEIGHT", totalQuantity: 5, unitType: "SET", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "BASE PLATE (SCAFFOLDING)", size: "-", totalQuantity: 20, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "ADJUSTABLE SHEET", size: "1'6\" X 1'0\"", totalQuantity: 20, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "ADJUSTABLE SHEET", size: "1'6\" X 1'6\"", totalQuantity: 20, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "ADJUSTABLE SHEET", size: "1'6\" X 2'0\"", totalQuantity: 20, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "ADJUSTABLE SHEET", size: "1'6\" X 3'0\"", totalQuantity: 50, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "EARTH BEAM CLAMP", size: "1'6\" X 9\"", totalQuantity: 200, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } },
    { materialName: "TOP CLAMP", size: "1'6\" X 9\"", totalQuantity: 50, unitType: "NOS", rent: { rentAmount: 0, rentType: "MONTH" } }
];



const seedMouldPurchases = async () => {
    console.log("=== Starting Mould Seed ===");

    const now = new Date();

    // 🔹 Delete old data
    const snapshot = await db.collection(MOULD_PURCHASES).get();
    if (!snapshot.empty) {
        console.log("Deleting old documents...");
        const batchDelete = db.batch();
        snapshot.docs.forEach(doc => batchDelete.delete(doc.ref));
        await batchDelete.commit();
        console.log(`Deleted ${snapshot.size} documents`);
    }

    // 🔹 Batch Insert
    const batchInsert = db.batch();

    seedData.forEach(item => {
        const docRef = db.collection(MOULD_PURCHASES).doc();

        batchInsert.set(docRef, {
            id: docRef.id,
            materialName: item.materialName,
            size: item.size,
            unitType: item.unitType,
            stock: {
                totalQuantity: item.totalQuantity,
                availableStock: item.totalQuantity,
                usedStock: 0
            },
            rent: {
                rentType: item.rent.rentType,
                rentAmount: item.rent.rentAmount
            },
            createdAt: now,
            updatedAt: now
        });
    });

    await batchInsert.commit();

    console.log(`✅ Successfully Seeded ${seedData.length} Materials`);
};

module.exports = seedMouldPurchases;

// Run directly
if (require.main === module) {
    seedMouldPurchases()
        .then(() => process.exit(0))
        .catch(err => {
            console.error("Error:", err);
            process.exit(1);
        });
}