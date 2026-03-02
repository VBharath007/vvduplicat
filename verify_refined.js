const mouldService = require("./src/modules/mould/mould.service");
const seedMouldPurchases = require("./src/modules/mould/seed");

async function runTests() {
    try {
        console.log("--- Starting Verification ---");

        // 1. Seed Data
        console.log("Step 1: Seeding data...");
        await seedMouldPurchases();

        // 2. Fetch purchases
        console.log("Step 2: Fetching purchases...");
        const purchases = await mouldService.getAllPurchases();
        const centringSheet = purchases.find(p => p.materialName === "CENTRING SHEET");
        if (!centringSheet) throw new Error("CENTRING SHEET not found after seeding");
        console.log(`Centring Sheet Stock:`, JSON.stringify(centringSheet.stock));

        // 3. Update Rent
        console.log("Step 3: Updating rent...");
        await mouldService.updatePurchase(centringSheet.id, {
            rent: { rentAmount: 30000, rentType: "MONTH" }
        });
        console.log(`Updated Rent for Centring Sheet to 30000/MONTH`);

        // 4. Create Rental
        console.log("Step 4: Creating rental for 10 Centring Sheets...");
        const rentalData = {
            clientName: "Refined Test Customer",
            items: [{ materialId: centringSheet.id, quantity: 10 }],
            startDate: new Date().toISOString().split("T")[0],
            endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        };

        const rental = await mouldService.createRental(rentalData);
        console.log(`Rental created ID: ${rental.id}`);
        console.log(`Used Days: ${rental.rentalPeriod.usedDays}`);
        console.log(`Total Used Amount: ${rental.calculation.totalUsedAmount}`);
        console.log(`Pending Amount: ${rental.payment.pendingAmount}`);

        // 5. Verify Stock Update
        console.log("Step 5: Verifying stock update...");
        const updatedPurchase = await mouldService.getPurchaseById(centringSheet.id);
        console.log(`Updated Stock:`, JSON.stringify(updatedPurchase.stock));

        // 6. Add Payment
        console.log("Step 6: Adding payment...");
        const rentalWithPayment = await mouldService.addPayment(rental.id, {
            amount: 2000,
            note: "Testing add payment"
        });
        console.log(`New Total Paid: ${rentalWithPayment.payment.totalPaidAmount}`);
        console.log(`New Pending: ${rentalWithPayment.payment.pendingAmount}`);

        // 7. Client Material History
        console.log("Step 7: Fetching client material history...");
        const history = await mouldService.getClientMaterialHistory(
            "Refined Test Customer",
            centringSheet.id
        );
        console.log(`History count: ${history.length}`);
        console.log(`History:`, JSON.stringify(history, null, 2));

        // 8. Close Rental
        console.log("Step 8: Closing rental...");
        await mouldService.closeRental(rental.id);
        const finalPurchase = await mouldService.getPurchaseById(centringSheet.id);
        console.log(`Final Stock after closing:`, JSON.stringify(finalPurchase.stock));

        // 9. Delete Rental Test
        console.log("Step 9: Creating another rental for delete test...");
        const rental2 = await mouldService.createRental({
            clientName: "Delete Test Client",
            items: [{ materialId: centringSheet.id, quantity: 5 }],
            startDate: new Date().toISOString().split("T")[0],
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            initialPayment: 1000
        });
        console.log(`Rental2 created ID: ${rental2.id}`);
        const stockBefore = await mouldService.getPurchaseById(centringSheet.id);
        console.log(`Stock before delete:`, JSON.stringify(stockBefore.stock));

        await mouldService.deleteRental(rental2.id);
        const stockAfter = await mouldService.getPurchaseById(centringSheet.id);
        console.log(`Stock after delete (should be restored):`, JSON.stringify(stockAfter.stock));

        console.log("--- Verification Complete ✅ ---");
    } catch (error) {
        console.error("!!! Test failed !!!");
        console.error(error.message);
        process.exit(1);
    }
}

runTests().then(() => process.exit(0));