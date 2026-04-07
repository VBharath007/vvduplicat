const { db } = require("../../config/firebase");

const mfaCollection = db.collection("Mfa").doc("mfaverification");

exports.verifyMfaCode = async (code) => {
  try {
    const doc = await mfaCollection.get();

    if (!doc.exists) {
      return { success: false, message: "MFA config not found" };
    }

    const data = doc.data();

    // assuming field name is "code"
    if (data.code == code) {
      return { success: true, message: "MFA Verified" };
    }

    return { success: false, message: "Invalid MFA Code" };
  } catch (error) {
    throw error;
  }
};