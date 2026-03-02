const fs = require("fs");

const structure = [
    "src/config",
    "src/controllers",
    "src/routes",
    "src/middleware",
    "src/services",
    "src/models",
    "src/utils",
];

structure.forEach(dir => {
    fs.mkdirSync(dir, { recursive: true });
});

const files = [
    "src/config/firebase.js",
    "src/config/db.js",
    "src/controllers/auth.controller.js",
    "src/controllers/admin.controller.js",
    "src/controllers/material.controller.js",
    "src/controllers/attendance.controller.js",
    "src/controllers/project.controller.js",
    "src/controllers/salary.controller.js",
    "src/controllers/employee.controller.js",
    "src/routes/auth.routes.js",
    "src/routes/material.routes.js",
    "src/routes/attendance.routes.js",
    "src/routes/project.routes.js",
    "src/routes/salary.routes.js",
    "src/routes/employee.routes.js",
    "src/routes/admin.routes.js",
    "src/middleware/auth.middleware.js",
    "src/middleware/role.middleware.js",
    "src/middleware/error.middleware.js",
    "src/middleware/mfa.middleware.js",
    "src/services/auth.service.js",
    "src/services/salary.service.js",
    "src/services/attendance.service.js",
    "src/services/project.service.js",
    "src/models/firestore.collections.js",
    "src/utils/jwt.js",
    "src/utils/helpers.js",
    "src/app.js",
    "server.js",
    ".env",
];

files.forEach(file => {
    fs.writeFileSync(file, "");
});

console.log("🚀 Backend structure created successfully!");
