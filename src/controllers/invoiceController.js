const invoiceService = require('../services/invoiceService');
const pdfService = require('../services/pdfService');

// 1. Create Invoice
exports.createInvoice = async (req, res) => {
    try {
        const result = await invoiceService.createInvoice(req.body);
        res.status(201).json({ status: "Success", data: result });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 2. Get All Invoices for a Project
exports.getProjectInvoices = async (req, res) => {
    try {
        const result = await invoiceService.getProjectInvoices(req.params.projectId);
        res.status(200).json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 3. Download Luxurious PDF
exports.downloadInvoicePDF = async (req, res) => {
    try {
        // Routes-la :invoiceId-nu irundha ingayum invoiceId-nu dhaan edukanum
        const { invoiceId } = req.params; 
        const invoiceData = await invoiceService.getInvoiceById(invoiceId);

        if (!invoiceData) {
            return res.status(404).json({ message: "Invoice not found!" });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${invoiceData.invoiceNumber}.pdf`);

        await pdfService.generateInvoicePDF(invoiceData, res);
    } catch (error) {
        console.error("PDF Download Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// 4. Update Payment Status (for .patch route)
exports.updatePaymentStatus = async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { status } = req.body; 
        
        const result = await invoiceService.updateInvoice(invoiceId, { status });
        res.status(200).json({ status: "Success", data: result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// 5. Delete Invoice (for .delete route)
exports.deleteInvoice = async (req, res) => {
    try {
        const { invoiceId } = req.params;
        await invoiceService.deleteInvoice(invoiceId);
        res.status(200).json({ status: "Success", message: "Invoice deleted successfully" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};