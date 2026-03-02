const materialService = require("./material.service");
const { validationResult } = require("express-validator");

const checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const err = new Error("Validation failed");
        err.statusCode = 400;
        err.data = errors.array();
        throw err;
    }
};

exports.createMaterial = async (req, res, next) => {
    try {
        checkValidation(req);
        const material = await materialService.createMaterial(req.body);
        res.status(201).json({ success: true, data: material });
    } catch (error) { next(error); }
};

exports.getAllMaterials = async (req, res, next) => {
    try {
        const materials = await materialService.getAllMaterials();
        res.status(200).json({ success: true, data: materials });
    } catch (error) { next(error); }
};

exports.getMaterialById = async (req, res, next) => {
    try {
        const material = await materialService.getMaterialById(req.params.id);
        res.status(200).json({ success: true, data: material });
    } catch (error) { next(error); }
};

exports.updateMaterial = async (req, res, next) => {
    try {
        const material = await materialService.updateMaterial(req.params.id, req.body);
        res.status(200).json({ success: true, data: material });
    } catch (error) { next(error); }
};

exports.deleteMaterial = async (req, res, next) => {
    try {
        await materialService.deleteMaterial(req.params.id);
        res.status(200).json({ success: true, message: "Material deleted" });
    } catch (error) { next(error); }
};

exports.dealerPurchase = async (req, res, next) => {
    try {
        checkValidation(req);
        const material = await materialService.dealerPurchase(req.params.id, req.body);
        res.status(200).json({ success: true, data: material });
    } catch (error) { next(error); }
};

exports.dealerPayment = async (req, res, next) => {
    try {
        checkValidation(req);
        const material = await materialService.dealerPayment(
            req.params.materialId,
            req.params.dealerId,
            req.body
        );
        res.status(200).json({ success: true, data: material });
    } catch (error) { next(error); }
};
