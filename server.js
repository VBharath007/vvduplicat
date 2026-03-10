const app = require("./src/app");
const createDefaultAdmin = require("./src/config/createDefaultAdmin");
const cron = require("node-cron");
const dayjs = require("dayjs");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);

    createDefaultAdmin().catch(err => {
        console.error("Default admin creation failed:", err.message);
    });
});


// cron.schedule("0 0 1 * *", async () => {
//     const lastMonth = dayjs().subtract(1, "month");
//     // await generateMonthlySalary(lastMonth.format("MM"), lastMonth.format("YYYY"));
// });
