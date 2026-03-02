const { db } = require("../config/firebase");

exports.getAllEmployees = async (req, res) => {
    try {
        const snapshot = await db.collection("users")
            .where("role", "==", "employee")
            .get();

        if (snapshot.empty) return res.status(404).json({ message: "No employees found" });

        let employees = snapshot.docs.map(doc => {
            return { id: doc.id, ...doc.data() };
        });

        // Sort by empID numerically/alphabetically
        employees.sort((a, b) => a.empID.localeCompare(b.empID));

        res.json({ message: "All employees fetched", employees });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getEmployeeDetail = async (req, res) => {
    try {
        const { empID } = req.params;

        const snapshot = await db.collection("users")
            .where("empID", "==", empID)
            .get();

        if (snapshot.empty) return res.status(404).json({ message: "Employee not found" });

        const employee = snapshot.docs[0].data();
        res.json({ employee });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


