const { db } = require("../config/firebase");
const bcrypt = require("bcryptjs");
const { USERS } = require("../models/firestore.collections");

exports.loginUser = async (identifier) => {
    let snapshot = await db
        .collection(USERS)
        .where("email", "==", identifier)
        .get();

    if (snapshot.empty) {
        snapshot = await db
            .collection(USERS)
            .where("empID", "==", identifier)
            .get();
    }

    if (snapshot.empty) return null;

    return snapshot.docs[0].data();
};

