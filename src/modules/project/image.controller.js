const imageService = require("./image.service");

exports.uploadImage = async (req, res) => {
    try {

        const { projectNo } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: "No image file provided"
            });
        }

        const metadata = {
            imageType: req.body.imageType || "others",
            uploadedBy: req.body.uploadedBy || "admin"
        };

        const image = await imageService.uploadImage(projectNo, file, metadata);

        res.status(201).json({
            success: true,
            message: "Image uploaded successfully",
            image
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getProjectImages = async (req, res) => {
    try {

        const { projectNo } = req.params;

        const images = await imageService.getProjectImages(projectNo);

        res.status(200).json({
            success: true,
            images
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getImageById = async (req, res) => {
    try {
        const { imageId } = req.params;
        const image = await imageService.getImageById(imageId);

        res.status(200).json({
            success: true,
            image
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getAllImages = async (req, res) => {
    try {
        const images = await imageService.getAllImages();

        res.status(200).json({
            success: true,
            images
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.deleteImage = async (req, res) => {
    try {
        const { imageId } = req.params;
        await imageService.deleteImage(imageId);

        res.status(200).json({
            success: true,
            message: "Image deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};