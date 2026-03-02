const app = require("./src/app");
const createDefaultAdmin = require("./src/config/createDefaultAdmin");
const cron = require("node-cron");
const dayjs = require("dayjs");
const { generateMonthlySalary } = require("./src/services/salary.service");

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await createDefaultAdmin();
});



cron.schedule("0 0 1 * *", async () => {
    const lastMonth = dayjs().subtract(1, "month");
    await generateMonthlySalary(lastMonth.format("MM"), lastMonth.format("YYYY"));
});

