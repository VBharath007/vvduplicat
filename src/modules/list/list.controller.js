const listService = require("./list.service");

const getLists = async (req, res, next) => {
  try {
    const data = await listService.getLists();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createList = async (req, res, next) => {
  try {
    const data = await listService.createList(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

const updateList = async (req, res, next) => {
  try {
    const data = await listService.updateList(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const deleteList = async (req, res, next) => {
  try {
    const data = await listService.deleteList(req.params.id);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
};

module.exports = { getLists, createList, updateList, deleteList };