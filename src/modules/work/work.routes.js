const express = require("express");
const router = express.Router();
const workController = require("./work.controller");

router.post("/", workController.createWork);
router.get("/", workController.getWorks);
router.get("/:workId", workController.getWorkById);
router.put("/:workId", workController.updateWork);
router.delete("/:workId", workController.deleteWork);


module.exports = router;
