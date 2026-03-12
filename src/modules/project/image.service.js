const { db, storage } = require("../../config/firebase");
const dayjs = require("dayjs");

exports.uploadImage = async (projectNo, file, metadata) => {
    try {

        if (!file) {
            throw new Error("No image file provided");
        }

        const bucket = storage.bucket();

        const timestamp = Date.now();
        const extension = file.originalname.split(".").pop();

        const imageId = `img_${timestamp}`;

        const storagePath = `projects/${projectNo}/images/${imageId}.${extension}`;

        const fileUpload = bucket.file(storagePath);

        await fileUpload.save(file.buffer, {
            metadata: {
                contentType: file.mimetype
            }
        });

        // make file public
        await fileUpload.makePublic();

        const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

        const imageRecord = {
            projectNo,
            imageId,
            imageName: file.originalname,
            imageUrl,
            imageType: metadata.imageType || "others",
            uploadedBy: metadata.uploadedBy || "admin",
            uploadedAt: dayjs().format("YYYY-MM-DD"),
            storagePath
        };

        await db.collection("projectImages").doc(imageId).set(imageRecord);

        return imageRecord;

    } catch (error) {
        throw new Error(`Failed to upload image: ${error.message}`);
    }
};

exports.getProjectImages = async (projectNo) => {
    try {

        const snapshot = await db
            .collection("projectImages")
            .where("projectNo", "==", projectNo)
            .get();

        const images = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            delete data.storagePath;
            images.push(data);
        });

        return images;

    } catch (error) {
        throw new Error(`Failed to fetch images: ${error.message}`);
    }
};

exports.getImageById = async (imageId) => {
    try {

        const doc = await db.collection("projectImages").doc(imageId).get();

        if (!doc.exists) {
            throw new Error("Image not found");
        }

        const data = doc.data();
        delete data.storagePath;

        return data;

    } catch (error) {
        throw new Error(`Failed to fetch image: ${error.message}`);
    }
};

exports.getAllImages = async () => {
    try {

        const snapshot = await db.collection("projectImages").get();

        const images = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            delete data.storagePath;
            images.push(data);
        });

        return images;

    } catch (error) {
        throw new Error(`Failed to fetch images: ${error.message}`);
    }
};

exports.deleteImage = async (imageId) => {
    try {

        const docRef = db.collection("projectImages").doc(imageId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw new Error("Image not found");
        }

        const imageData = doc.data();
        const bucket = storage.bucket();

        if (imageData.storagePath) {
            const file = bucket.file(imageData.storagePath);
            await file.delete();
        }

        await docRef.delete();

        return { message: "Image deleted successfully" };

    } catch (error) {
        throw new Error(`Failed to delete image: ${error.message}`);
    }
};