const jwt = require("jsonwebtoken");
require('dotenv').config();

exports.generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "1d",
    });
};

const token = process.env.ADMIN_JWT;

console.log("Loaded JWT safely:", token);
