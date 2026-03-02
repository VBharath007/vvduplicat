

const { db } = require('../config/firebase'); // Centralized DB import
const admin = require('firebase-admin');

// 🟢 CREATE: Add Task (Today / Weekly / Monthly)
exports.saveTask = async (taskData) => {
    // Basic Task Structure — use null fallbacks so Firestore never gets undefined
    let taskObject = {
        taskName: taskData.taskName || null,
        priority: taskData.priority || null,
        section: taskData.section || null,
        status: taskData.status || 'Pending',
        createdAt: admin.firestore.Timestamp.now()
    };

    // --- Section logic based on your requirement ---
    if (taskData.section === 'Today') {
        taskObject.startTime = taskData.startTime || null;
        taskObject.endTime = taskData.endTime || null;
    } else {
        // For Weekly and Monthly sections
        taskObject.startDate = taskData.startDate || null;
        taskObject.endDate = taskData.endDate || null;
    }

    // Saving to 'tasks' collection
    const docRef = await db.collection('tasks').add(taskObject);
    return { id: docRef.id, ...taskObject };
};

// 🔵 READ: Get History by Section
exports.getHistoryBySection = async (sectionName) => {
    const snapshot = await db.collection('tasks')
        .where('section', '==', sectionName)
        .get();

    let history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 🕒 Manual Sorting (Recent First) - Idhu index error varaama thadukkum
    history.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
    });

    return history;
};

// 🟡 UPDATE: Edit Task details or status
exports.updateTask = async (id, updateData) => {
    await db.collection('tasks').doc(id).update({
        ...updateData,
        updatedAt: admin.firestore.Timestamp.now()
    });
    return { id, message: "Task updated successfully" };
};

// 🔴 DELETE: Remove task
exports.deleteTask = async (id) => {
    await db.collection('tasks').doc(id).delete();
    return { message: "Task deleted from history" };
};