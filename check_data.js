const { db } = require("./src/config/firebase");

async function checkData() {
    const phoneNumber = "9994167567";
    const projectNo = "VVP005";

    const snapshot = await db.collection("materialReceived")
        .where("dealerContact", "==", phoneNumber)
        .where("projectNo", "==", projectNo)
        .get();

    if (snapshot.empty) {
        console.log(`No bills found for dealer ${phoneNumber} on project ${projectNo}`);
    } else {
        console.log(`Found ${snapshot.size} bills for dealer ${phoneNumber} on project ${projectNo}`);
        let totalPending = 0;
        snapshot.forEach(doc => {
            const d = doc.data();
            totalPending += (Number(d.totalAmount) || 0) - (Number(d.paidAmount) || 0);
            console.log(`Bill ID: ${doc.id}, Total: ${d.totalAmount}, Paid: ${d.paidAmount}, Bal: ${Number(d.totalAmount) - Number(d.paidAmount)}`);
        });
        console.log(`Total Pending: ${totalPending}`);
    }
    process.exit(0);
}

checkData();
