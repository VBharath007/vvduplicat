// src/modules/project/bank.controller.js

const bankService = require("./bank.service");

exports.getAllBanks = async (req, res) => {
    try {
        const banks = await bankService.getAllBanks();
        res.status(200).json({ success: true, data: banks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createBank = async (req, res) => {
    try {
        const result = await bankService.createBank(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.createTemporaryBankForAdvance = async (req, res) => {
    try {
        const result = await bankService.createTemporaryBankForAdvance(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateBank = async (req, res) => {
    try {
        const result = await bankService.updateBank(req.params.bankId, req.body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.incrementBankBalance = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Valid amount is required" });
        }
        const result = await bankService.incrementBankBalance(req.params.bankId, amount);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.decrementBankBalance = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Valid amount is required" });
        }
        const result = await bankService.decrementBankBalance(req.params.bankId, amount);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.addAdvanceWithPaymentMode = async (req, res) => {
    try {
        const { projectNo } = req.params;
        const result = await bankService.addAdvanceWithPaymentMode(projectNo, req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = exports;