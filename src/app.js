const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

dotenv.config();

const app = express();


app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',   // Set FRONTEND_URL in Railway to lock down CORS
    credentials: true
}));
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));


// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/attendance", require("./routes/attendance.routes"));
app.use("/api/employee", require("./routes/employee.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/addadmin", require("./routes/addadmin.routes"));
app.use("/api/mould", require("./modules/mould/mould.routes"));
app.use("/api/tasks", require("./routes/task.routes"));

// New Modular Architecture Routes for Construction Management System
app.use("/api/projects", require("./modules/project/project.routes"));
app.use("/api/works", require("./modules/work/work.routes"));
app.use("/api/materials", require("./modules/material/material.routes"));
app.use("/api/advances", require("./modules/advance/advance.routes"));
app.use("/api/site-expenses", require("./modules/expense/expense.routes"));
app.use("/api/dealers", require("./modules/dealer/dealer.routes"));
app.use("/api/approvals", require("./modules/approval/approval.routes"));
// Error Middleware
app.use(require("./middleware/error.middleware").errorHandler);

module.exports = app;
