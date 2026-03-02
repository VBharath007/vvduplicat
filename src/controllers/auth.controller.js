const { db } = require("../config/firebase"); // 👈 destructure db
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");



exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and Password required" });
        }

        const userSnapshot = await db
            .collection("users")    // 👈 keep same collection everywhere
            .where("email", "==", email)
            .get();

        if (userSnapshot.empty) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = userSnapshot.docs[0].data();

        // password = empID logic for employee
        if (user.role === "employee" && user.empID !== password) {
            return res.status(401).json({ message: "Invalid password" });
        }

        // admin login: check hashed password
        if (user.role === "admin") {
            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.status(401).json({ message: "Invalid password" });
        }

        // generate token
        const token = generateToken({
            id: userSnapshot.docs[0].id,
            role: user.role,
            empID: user.empID
        });

        res.status(200).json({
            message: "Login successful",
            token,
            user
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



exports.verifyMFA = async (req, res) => {
    const { mfaCode, user } = req.body;

    if (mfaCode !== process.env.MFA_DEFAULT)
        return res.status(400).json({ message: "Invalid MFA Code" });

    const token = generateToken({
        id: user.uid,
        role: user.role,
        empID: user.empID
    });

    res.json({ token });
};

exports.getMe = async (req, res) => {
    try {
        const userDoc = await db.collection("users").doc(req.user.id).get();
        if (!userDoc.exists) {
            return res.status(404).json({ message: "User not found" });
        }
        const user = userDoc.data();
        delete user.password;
        res.status(200).json({ data: user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
