const { db } = require("../config/firebase"); // 👈 destructure db
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");



exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and Password required" });
        }

        // ── Step 1: Search in 'admins' collection ──────────────
        let userDoc = null;
        let userId = null;
        let source = 'admins';

        const adminSnap = await db
            .collection('admins')
            .where('email', '==', email)
            .get();

        if (!adminSnap.empty) {
            userId = adminSnap.docs[0].id;
            userDoc = adminSnap.docs[0].data();
        } else {
            // ── Step 2: Fall back to 'users' collection (employees) ──
            source = 'users';
            const userSnap = await db
                .collection('users')
                .where('email', '==', email)
                .get();

            if (userSnap.empty) {
                return res.status(404).json({ message: "User not found" });
            }
            userId = userSnap.docs[0].id;
            userDoc = userSnap.docs[0].data();
        }

        // ── Step 3: Password verification ──────────────────────
        if (userDoc.role === 'employee') {
            // Employee: password = empID (plain text)
            if (userDoc.empID !== password) {
                return res.status(401).json({ message: "Invalid password" });
            }
        } else {
            // Admin: support both hashed (bcrypt) AND plain-text passwords
            const isHashed = userDoc.password?.startsWith('$2');
            let match = false;
            if (isHashed) {
                match = await bcrypt.compare(password, userDoc.password);
            } else {
                // Plain-text comparison (default admin before hashing)
                match = (password === userDoc.password);
            }
            if (!match) return res.status(401).json({ message: "Invalid password" });
        }

        // ── Step 4: Generate JWT ────────────────────────────────
        const token = generateToken({
            id: userId,
            role: userDoc.role,
            empID: userDoc.empID
        });

        const safeUser = { ...userDoc };
        delete safeUser.password;   // never send password in response

        res.status(200).json({
            message: "Login successful",
            token,
            user: safeUser
        });

    } catch (error) {
        console.error('[login]', error.message);
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
        // Try admins collection first, then users
        let userDoc = await db.collection('admins').doc(req.user.id).get();
        if (!userDoc.exists) {
            userDoc = await db.collection('users').doc(req.user.id).get();
        }
        if (!userDoc.exists) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = userDoc.data();
        delete user.password;
        res.status(200).json({ data: user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/auth/dashboard  →  returns admin info + summary counts
// ─────────────────────────────────────────────────────────────────
exports.dashboard = async (req, res) => {
    try {
        // Get admin profile
        let userDoc = await db.collection('admins').doc(req.user.id).get();
        if (!userDoc.exists) {
            userDoc = await db.collection('users').doc(req.user.id).get();
        }

        const adminData = userDoc.exists ? { ...userDoc.data() } : {};
        delete adminData.password;

        // Get summary counts (parallel)
        const [employeesSnap, approvalsSnap, projectsSnap] = await Promise.all([
            db.collection('users').where('role', '==', 'employee').get(),
            db.collection('approvals').get(),
            db.collection('projects').get(),
        ]);

        res.status(200).json({
            success: true,
            admin: adminData,
            summary: {
                totalEmployees: employeesSnap.size,
                totalApprovals: approvalsSnap.size,
                totalProjects: projectsSnap.size,
            }
        });
    } catch (error) {
        console.error('[dashboard]', error.message);
        res.status(500).json({ message: error.message });
    }
};
