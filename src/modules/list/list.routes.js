const router = require("express").Router();
const ctrl = require("./list.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

router.get("/",         verifyToken, authorize , ctrl.getLists);
router.post("/",        verifyToken, authorize , ctrl.createList);
router.put("/:id",      verifyToken, authorize , ctrl.updateList);
router.delete("/:id",   verifyToken, authorize , ctrl.deleteList);

module.exports = router;