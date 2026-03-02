const { AdminService, findAdmin, createMfaPassword, verifyMfaPassword, generateToken, generateMfaSetupToken, getAdminByEmpID } = require("../services/addadmin.service");

const jwt = require("jsonwebtoken");

// JWT helper
exports.registerAdmin = async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;

        const { id, empID } = await AdminService.register({
            name, email, password, phone, role
        });

        res.json({
            message: "Registration successful! Use your Employee ID to login.",
            id,
            empID
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Add Admin
exports.addAdmin = async (req, res) => {
    try {
        if (req.user.role !== "admin")
            return res.status(403).json({ message: "Only default admin can add new admin" });

        const { name, email, empID, labourType, wagesType, salaryPerDay } = req.body;

        const { id, tempPassword } = await AdminService.addAdmin({
            name, email, empID, labourType, wagesType, salaryPerDay
        });

        res.json({ message: "Admin Created Successfully", id, tempPassword });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// 🔹 Get All Admins
exports.getAdmins = async (req, res) => {
    try {
        const admins = await AdminService.getAllAdmins();
        res.json({ admins });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// 🔹 Update Admin
exports.updateAdmin = async (req, res) => {
    try {
        const { empID } = req.params;
        const updates = req.body;

        const admin = await getAdminByEmpID(empID);
        if (!admin) return res.status(404).json({ message: "Admin not found" });

        if (req.user.role !== "admin")
            return res.status(403).json({ message: "Access denied" });

        await AdminService.updateAdmin(admin.ref, updates);
        res.json({ message: "Admin updated successfully" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// 🔹 Delete Admin
exports.deleteAdmin = async (req, res) => {
    try {
        const { empID } = req.params;

        const admin = await getAdminByEmpID(empID);
        if (!admin) return res.status(404).json({ message: "Admin not found" });

        if (!req.user.defaultAdmin)
            return res.status(403).json({ message: "Only default admin can delete admin" });

        await AdminService.deleteAdmin(admin.ref);
        res.json({ message: "Admin deleted successfully" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// 🔹 First Login (NO TOKEN GENERATION HERE)
exports.loginAdmin = async (req, res) => {
    try {
        const { email, empID } = req.body;

        if (!email || !empID) {
            return res.status(400).json({
                message: "Email and empID are required"
            });
        }

        const user = await findAdmin(email, empID);
        if (!user)
            return res.status(404).json({ message: "Admin not found" });

        if (!user.mfaPassword) {
            const setupToken = generateMfaSetupToken(user);

            return res.json({
                message: "Create your MFA password",
                mfaSetupToken: setupToken
            });
        }

        return res.json({
            message: "Enter MFA password"
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// 🔹 Setup MFA (No Login Token Here)
exports.setupMfa = async (req, res) => {
    try {
        const { mfaSetupToken, mfaPassword } = req.body;

        const decoded = jwt.verify(mfaSetupToken, process.env.JWT_SECRET);

        await createMfaPassword(decoded.id, mfaPassword);

        res.json({
            message: "Successfully created MFA password"
        });

    } catch (err) {
        res.status(400).json({ message: "Invalid or expired token" });
    }
};


// 🔹 Verify MFA & Generate JWT
exports.verifyMfa = async (req, res) => {
    try {
        const { email, empID, mfaPassword } = req.body;

        const user = await findAdmin(email, empID);
        if (!user)
            return res.status(404).json({ message: "Admin not found" });

        const isValid = await verifyMfaPassword(user, mfaPassword);
        if (!isValid)
            return res.status(401).json({ message: "Invalid MFA password" });

        const token = generateToken(user);

        // Exclude sensitive fields
        const { password, mfaPassword: userMfaPassword, ...userWithoutSecrets } = user;

        res.json({
            message: "Login successful",
            token,
            user: userWithoutSecrets
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};



// 🔹 Get Own Profile (Protected Route)
exports.getAdminProfile = async (req, res) => {
    try {
        const admin = await getAdminByEmpID(req.user.empID);
        if (!admin) return res.status(404).json({ message: "Admin not found" });

        res.json({ profile: admin });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

