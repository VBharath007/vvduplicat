const salaryService = require("../services/salary.service");
const SALARIES = "salaries";
const { db } = require("../config/firebase");

exports.fetchSalaryByEmpID = async (empID) => {
    const snapshot = await db.collection(SALARIES)
        .where("empID", "==", empID)
        .get();

    return snapshot.docs.map(doc => doc.data());
};

// Employee: Get own salary
exports.getMySalary = async (req, res) => {
    try {
        const empID = req.params.empID; // ✅ from URL

        if (!empID) return res.status(400).json({ message: "empID is required" });

        // 🔐 Security: Employee can only access their own salary
        if (req.user.role !== "admin" && req.user.empID !== empID) {
            return res.status(403).json({ message: "Access denied" });
        }

        const salaries = await salaryService.getSalaryByEmpID(empID);

        res.status(200).json({ salaries });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


exports.getSalaryByEmpID = async (req, res) => {
    try {
        const { empID } = req.params;

        const snapshot = await db.collection(SALARIES)
            .where("empID", "==", empID)
            .orderBy("year", "asc")
            .orderBy("month", "asc")
            .get();

        const salaries = snapshot.docs.map(doc => {
            const data = doc.data();

            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt
                    ? data.createdAt.toDate().toLocaleString()
                    : null
            };
        });

        res.status(200).json({ salaries });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};







// Admin: Get all salaries
exports.getAllSalaries = async (req, res) => {
    try {
        const salaries = await salaryService.getAllSalaries();
        res.status(200).json({ salaries });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Admin: Generate monthly salary
exports.generateMonthlySalary = async (req, res) => {
    try {
        const { month, year } = req.body;

        if (!month || !year) return res.status(400).json({ message: "Month and year are required" });

        const salaries = await salaryService.generateMonthlySalary(month, year);

        res.status(200).json({
            message: "Monthly salary generated successfully",
            salaries
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};





exports.createSalary = async (req, res) => {
    try {
        const salary = req.body;

        if (!salary.empID || !salary.month || !salary.year) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        await db.collection(SALARIES).add({
            ...salary,
            createdAt: new Date()
        });

        res.json({ message: "Salary created successfully" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


exports.updateSalary = async (req, res) => {
    try {
        const { id } = req.params;

        await db.collection(SALARIES).doc(id).update(req.body);

        res.json({ message: "Salary updated successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteSalary = async (req, res) => {
    try {
        const { id } = req.params;

        await db.collection(SALARIES).doc(id).delete();

        res.json({ message: "Salary deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// ============================================================
// ADVANCE SALARY CONTROLLERS
// ============================================================

// ➕ Give Advance Salary
exports.giveAdvanceSalary = async (req, res) => {
    try {
        const { empID, advanceAmount, month, year, reason } = req.body;

        if (!empID || !advanceAmount || !month || !year) {
            return res.status(400).json({ message: "empID, advanceAmount, month, year are required." });
        }

        const result = await salaryService.giveAdvanceSalary({ empID, advanceAmount, month, year, reason });
        res.status(201).json({
            success: true,
            message: `Advance of ₹${advanceAmount} given to ${result.employeeName}. Remaining salary: ₹${result.remainingSalary}`,
            data: result
        });
    } catch (e) {
        if (e.code === "ADVANCE_EXCEEDS_SALARY") return res.status(400).json({ success: false, message: e.message });
        res.status(500).json({ success: false, message: e.message });
    }
};

// 📖 Get Advance History for an Employee
exports.getAdvanceHistory = async (req, res) => {
    try {
        const { empID } = req.params;
        const { month, year } = req.query;  // Optional filters

        const result = await salaryService.getAdvanceHistory(empID, month, year);
        res.status(200).json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// 💰 Settle Final Salary (Calculate remaining pay on salary day)
exports.settleFinalSalary = async (req, res) => {
    try {
        const { empID, month, year } = req.body;

        if (!empID || !month || !year) {
            return res.status(400).json({ message: "empID, month, year are required." });
        }

        const result = await salaryService.settleFinalSalary(empID, month, year);
        res.status(200).json({
            success: true,
            message: `Final salary settled. ₹${result.totalAdvanced} was advanced. Final payable: ₹${result.finalSalary}`,
            data: result
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
