const projectService = require("../services/project.service");

exports.createProject = async (req, res, next) => {
    try {
        await projectService.createProject(req.body);
        res.json({ message: "Project Created Successfully" });
    } catch (err) {
        next(err);
    }
};
