const app = require("./src/app");
const createDefaultAdmin = require("./src/config/createDefaultAdmin");
const cron = require("node-cron");
const dayjs = require("dayjs");

const PORT = process.env.PORT || 5000;

// ─── Global crash guards ───────────────────────────────────────────────────
// Without these, ANY unhandled async error silently kills the process.
process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Promise Rejection:", reason);
    // Do NOT call process.exit() here — let the server keep running.
    // If you want hard-crash on rejection, uncomment the line below:
    // process.exit(1);
});

process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
    // Uncaught exceptions leave the app in undefined state, so exit + restart.
    process.exit(1);
});
// ──────────────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);

    // Call createDefaultAdmin explicitly and catch any errors.
    // Previously it was only imported (never called here), so if the module
    // self-invokes and throws, there was nothing to catch it.
    try {
        await createDefaultAdmin();
        const { initDefaultSubLabourTypes } = require("./src/modules/labour/labour.service");
        await initDefaultSubLabourTypes();
    } catch (err) {
        console.error("❌ Initialization failed:", err.message);
    }
});


// cron.schedule("0 0 1 * *", async () => {
//     const lastMonth = dayjs().subtract(1, "month");
//     // await generateMonthlySalary(lastMonth.format("MM"), lastMonth.format("YYYY"));
// });
