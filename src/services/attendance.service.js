const dayjs = require("dayjs");
const { db } = require("../config/firebase");
const { ATTENDANCE } = require("../models/firestore.collections");


exports.markAttendance = async (empID, data) => {
    try {

        const today = dayjs();
        const date = today.format("YYYY-MM-DD");
        const month = today.format("YYYY-MM");

        // ✅ Sunday skip
        if (today.day() === 0) {
            return { message: "Sunday - Weekly Leave" };
        }

        // ✅ Default timings
        const startTime = data.startTime
            ? new Date(`${date}T${data.startTime}:00`)
            : new Date(`${date}T09:00:00`);

        const endTime = data.endTime
            ? new Date(`${date}T${data.endTime}:00`)
            : new Date(`${date}T17:00:00`);

        // ✅ Calculate worked hours
        let workedHours = (endTime - startTime) / (1000 * 60 * 60);

        if (workedHours < 0) workedHours = 0;

        // ✅ Auto Status Logic
        let status = "Absent";

        if (workedHours >= 8) {
            status = "Present";
        } else if (workedHours >= 4) {
            status = "Half Day";
        }

        await db
            .collection(ATTENDANCE)
            .doc(empID)
            .collection(month)
            .doc(date)
            .set({
                status: data?.status || "Absent",       // present | half | absent
                startTime: startTime,      // Firestore stores as Timestamp
                endTime: endTime,          // Firestore stores as Timestamp
                date,
                createdAt: new Date()
            }, { merge: true });          // merge true avoids overwriting other fields

        return {
            message: "Attendance marked successfully",
            status,
            workedHours
        };

    } catch (err) {
        throw new Error(err.message);
    }
};

