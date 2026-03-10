const imageService = require("./image.service");

// Upload Image
exports.uploadImage = async (req, res) => {
    try {
        const { projectNo } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: "No image file provided" });
        }

        const metadata = {
            imageType: req.body.imageType || "others",
            uploadedBy: req.body.uploadedBy || req.user?.id || "admin",
        };

        const result = await imageService.uploadImage(projectNo, file, metadata);

        res.status(201).json({
            success: true,
            message: "Image uploaded successfully",
            image: result,
        });
    } catch (error) {
        console.error("Upload Image Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Fetch All Images for a Project
exports.getProjectImages = async (req, res) => {
    try {
        const { projectNo } = req.params;
        const images = await imageService.getProjectImages(projectNo);

        res.status(200).json({
            success: true,
            projectNo,
            images,
        });
    } catch (error) {
        console.error("Get Project Images Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete Image
exports.deleteImage = async (req, res) => {
    try {
        const { imageId } = req.params;

        await imageService.deleteImage(imageId);

        res.status(200).json({
            success: true,
            message: "Image deleted successfully",
        });
    } catch (error) {
        console.error("Delete Image Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
