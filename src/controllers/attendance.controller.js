const attendanceService = require("../services/attendance.service");
const { db } = require("../config/firebase");
const { ATTENDANCE } = require("../models/firestore.collections");
const dayjs = require("dayjs");


exports.markAttendance = async (req, res, next) => {
    try {
        const { empID } = req.params;
        await attendanceService.markAttendance(empID, req.body);
        res.json({ message: "Attendance Marked" });
    } catch (err) {
        next(err);
    }
};

exports.getAttendanceByMonth = async (req, res) => {
    try {
        const { empID, month } = req.params;

        const snapshot = await db
            .collection(ATTENDANCE)
            .doc(empID)
            .collection(month)
            .get();

        const attendance = snapshot.docs.map(doc => {
            const data = doc.data();

            return {
                ...data,
                startTime: data.startTime
                    ? dayjs(data.startTime.toDate()).format("DD-MM-YYYY HH:mm:ss")
                    : null,
                endTime: data.endTime
                    ? dayjs(data.endTime.toDate()).format("DD-MM-YYYY HH:mm:ss")
                    : null,
                createdAt: data.createdAt
                    ? dayjs(data.createdAt.toDate()).format("DD-MM-YYYY HH:mm:ss")
                    : null
            };
        });

        res.json({ attendance });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
