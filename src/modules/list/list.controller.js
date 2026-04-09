const listService = require("./list.service");

const uid = (req) => req.user?.uid || req.headers["x-user-id"];

const getLists = async (req, res, next) => {
  try {
    const lists = await listService.getLists(uid(req));
    res.json({ success: true, data: lists });
  } catch (err) {
    next(err);
  }
};

const createList = async (req, res, next) => {
  try {
    const list = await listService.createList({ ...req.body, userId: uid(req) });
    res.status(201).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
};

const updateList = async (req, res, next) => {
  try {
    const list = await listService.updateList(req.params.id, req.body);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
};

const deleteList = async (req, res, next) => {
  try {
    const result = await listService.deleteList(req.params.id, uid(req));
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLists, createList, updateList, deleteList };