const { db, storage } = require("../../config/firebase");
const dayjs = require("dayjs"); // Using dayjs for date formatting

exports.uploadImage = async (projectNo, file, metadata) => {
    try {
        if (!file) throw new Error("No image file provided");

        const bucket = storage.bucket();
        const timestamp = Date.now();
        const extension = file.originalname.split('.').pop() || 'jpg';
        const imageId = `img_${timestamp}`;
        // Store path based on Project Number
        const storagePath = `projects/${projectNo}/images/${imageId}.${extension}`;
        const fileUpload = bucket.file(storagePath);

        // Upload file to Firebase Storage
        await fileUpload.save(file.buffer, {
            metadata: {
                contentType: file.mimetype,
            },
        });

        // Make the file publicly accessible via Firebase Storage token
        // The simple public URL format is:
        const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;

        // Save metadata to Firestore
        const imageRecord = {
            projectNo,
            imageId,
            imageName: file.originalname,
            imageUrl: fileUrl,
            imageType: metadata.imageType || "others",
            uploadedBy: metadata.uploadedBy || "admin",
            uploadedAt: dayjs().format("YYYY-MM-DD"),
            storagePath // to easily delete it later
        };

        await db.collection("projectImages").doc(imageId).set(imageRecord);

        return imageRecord;
    } catch (error) {
        throw new Error(`Failed to upload image: ${error.message}`);
    }
};

exports.getProjectImages = async (projectNo) => {
    try {
        const snapshot = await db.collection("projectImages")
            .where("projectNo", "==", projectNo)
            .get();

        const images = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // remove storage path before sending to client, unless needed
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

        // Delete from Firebase Storage using the precise storagePath
        if (imageData.storagePath) {
            const fileUpload = bucket.file(imageData.storagePath);
            await fileUpload.delete().catch((err) => {
                console.error("Firebase Storage delete error:", err);
            });
        }

        // Remove from Firestore
        await docRef.delete();

        return { message: "Image deleted successfully" };
    } catch (error) {
        throw new Error(`Failed to delete image: ${error.message}`);
    }
};
