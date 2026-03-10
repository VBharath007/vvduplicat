const taskService = require('../services/task.service');

// Create Task
exports.addTask = async (req, res) => {
    try {
        const task = await taskService.saveTask(req.body);
        res.status(201).json({ success: true, data: task });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Tasks by Type (Daily/Weekly/Monthly)
exports.getHistory = async (req, res) => {
    try {
        const type = req.query.type || req.query.section;
        if (!type) {
            return res.status(400).json({ success: false, message: "Task type (Daily/Weekly/Monthly) is required" });
        }
        const tasks = await taskService.getTasksByType(type);
        res.status(200).json({ success: true, count: tasks.length, data: tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update Task
exports.editTask = async (req, res) => {
    try {
        const task = await taskService.updateTask(req.params.id, req.body);
        res.status(200).json({ success: true, data: task });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete Task
exports.removeTask = async (req, res) => {
    try {
        await taskService.deleteTask(req.params.id);
        res.status(200).json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};