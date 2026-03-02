const taskService = require('../services/task.service');

// Add Task (Create)
const addTask = async (req, res) => {
    try {
        const task = await taskService.saveTask(req.body);
        res.status(201).json({ success: true, data: task });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get History (Read)
const getHistory = async (req, res) => {
    try {
        const { section } = req.query; // Today, Weekly, or Monthly
        
        // Safety check: Section name illa-na error kaatum
        if (!section) {
            return res.status(400).json({ success: false, message: "Section parameter is required" });
        }

        const history = await taskService.getHistoryBySection(section);
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update Task (Update)
const editTask = async (req, res) => {
    try {
        const task = await taskService.updateTask(req.params.id, req.body);
        res.status(200).json({ success: true, data: task });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete Task (Delete)
const removeTask = async (req, res) => {
    try {
        await taskService.deleteTask(req.params.id);
        res.status(200).json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { addTask, getHistory, editTask, removeTask };