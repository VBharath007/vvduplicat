const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

router.post('/create', invoiceController.createInvoice);
router.get('/project/:projectId', invoiceController.getProjectInvoices);
router.get('/download/:invoiceId', invoiceController.downloadInvoicePDF);
router.patch('/status/:invoiceId', invoiceController.updatePaymentStatus);
router.delete('/delete/:invoiceId', invoiceController.deleteInvoice);

module.exports = router;