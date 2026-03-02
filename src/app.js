const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/attendance", require("./routes/attendance.routes"));
app.use("/api/salary", require("./routes/salary.routes"));
app.use("/api/employee", require("./routes/employee.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
// app.use("/api/material", require("./routes/material.routes"));
app.use("/api/addadmin", require("./routes/addadmin.routes"));
app.use("/api/mould", require("./modules/mould/mould.routes"));
app.use("/api/materials", require("./modules/material/material.routes"));
app.use("/api/invoice", require("./routes/invoiceRoutes"));
app.use("/api/sitework", require("./routes/siteworkRoutes"));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/approval", require("./routes/approvalRoutes"));
app.use("/api/tasks", require("./routes/task.routes"));
app.use("/api/salary-transactions", require("./routes/salaryTransaction.routes"));






// Error Middleware
app.use(require("./middleware/error.middleware").errorHandler);

module.exports = app;
