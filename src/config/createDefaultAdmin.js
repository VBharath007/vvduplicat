const { db } = require("./firebase");  // 👈 IMPORT CORRECTLY

const createDefaultAdmin = async () => {
    try {

        const adminRef = db.collection("admins").doc("defaultAdmin");

        const doc = await adminRef.get();

        if (!doc.exists) {
            await adminRef.set({
                empId: "ADMIN001",
                name: "vvconstruction",
                email: process.env.DEFAULT_ADMIN_EMAIL,
                password: process.env.DEFAULT_ADMIN_PASSWORD,
                role: "admin",
                createdAt: new Date()
            });

            console.log("✅ Default Admin Created");
        } else {
            console.log("ℹ Default Admin Already Exists");
        }

    } catch (error) {
        console.error("❌ Error creating admin:", error.message);
    }
};

module.exports = createDefaultAdmin;
