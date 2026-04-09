const router = require("express").Router();
const ctrl = require("./list.controller");
const { verifyToken } = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

router.get("/",          ctrl.getLists);
router.post("/",         ctrl.createList);
router.put("/:id",       ctrl.updateList);
router.delete("/:id",    ctrl.deleteList);

module.exports = router;