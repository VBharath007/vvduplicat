/*
const { db } = require('../config/firebase');
const admin = require('firebase-admin');

exports.createInvoice = async (data) => {
    let subtotal = 0;
    const items = (data.items || []).map((item, index) => {
        const total = parseFloat(item.qty || 0) * parseFloat(item.rate || 0);
        subtotal += total;
        return {
            sNo: index + 1,
            description: item.description || "",
            qty: parseFloat(item.qty || 0),
            unit: item.unit || "Nos",
            rate: parseFloat(item.rate || 0),
            totalAmount: total
        };
    });

    const discount = parseFloat(data.discount || 0);
    const taxableAmount = subtotal - discount;
    const gstRate = parseFloat(data.gstPercentage || 0);
    const gstAmount = taxableAmount * (gstRate / 100);
    
    const invoiceData = {
        invoiceNumber: data.invoiceNumber || `INV-${Date.now()}`,
        invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
        dueDate: data.dueDate || "",
        projectName: data.projectName || "",
        projectId: data.projectId || "",
        workOrderNo: data.workOrderNo || "",
        companyDetails: data.companyDetails || {},
        clientDetails: data.clientDetails || {},
        items,
        financials: {
            subtotal,
            discount,
            taxableAmount,
            gstPercentage: gstRate,
            cgst: gstAmount / 2,
            sgst: gstAmount / 2,
            gstAmount,
            grandTotal: taxableAmount + gstAmount,
            advancePaid: parseFloat(data.advancePaid || 0),
            balanceAmount: (taxableAmount + gstAmount) - parseFloat(data.advancePaid || 0)
        },
        paymentDetails: data.paymentDetails || {},
        terms: data.terms || "Standard construction terms apply.",
        paymentStatus: "Pending",
        createdAt: admin.firestore.Timestamp.now()
    };

    const docRef = await db.collection('invoices').add(invoiceData);
    return { id: docRef.id, ...invoiceData };
};

exports.getProjectInvoices = async (projectId) => {
    const snap = await db.collection('invoices').where('projectId', '==', projectId).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

exports.getInvoiceById = async (id) => {
    const doc = await db.collection('invoices').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
};

exports.updateStatus = async (id, status) => {
    return await db.collection('invoices').doc(id).update({ paymentStatus: status });
};

exports.deleteInvoice = async (id) => {
    return await db.collection('invoices').doc(id).delete();
};

*/



const { db } = require('../config/firebase');

exports.createInvoice = async (data) => {
    // 1. First, andha project details-ah edukanum
    const projectRef = db.collection('projects').doc(data.projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
        throw new Error("Project not found! Check the Project ID.");
    }

    const projectData = projectDoc.data();

    // 2. Invoice Number logic (Unique-ah irukka)
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    // 3. Invoice Object - Idhula dhaan Project details-ah sethu link panroam
    const invoiceData = {
        invoiceNumber: invoiceNumber,
        date: new Date().toISOString(),
        status: data.status || "Pending",
        
        // Project Details Linked from Project Module
        projectDetails: {
            projectId: data.projectId,
            projectName: projectData.projectName,
            location: projectData.location?.city || "Site Location",
            siteEngineer: projectData.siteEngineer?.name || "N/A"
        },

        // Client Details Linked from Project Module
        clientInfo: {
            name: projectData.clientDetails?.clientName,
            address: projectData.clientDetails?.clientAddress,
            contact: projectData.clientDetails?.clientContact,
            email: projectData.clientDetails?.clientEmail
        },

        // Billing Items (Materials or Services)
        items: data.items || [], // [{item: 'Cement', qty: 10, rate: 500, total: 5000}]
        
        // Calculations
        subTotal: parseFloat(data.subTotal || 0),
        tax: parseFloat(data.tax || 0),
        grandTotal: parseFloat(data.grandTotal || 0),

        // Metadata
        createdAt: new Date().toISOString()
    };

    // 4. Save to Invoices Collection
    const docRef = await db.collection('invoices').add(invoiceData);
    
    return { id: docRef.id, ...invoiceData };
};

// Invoice ID-ah vechu details edukka (PDF-ku use aagum)
exports.getInvoiceById = async (id) => {
    const doc = await db.collection('invoices').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
};

// Oru project-oda ella invoices-ahyum paarkka
exports.getProjectInvoices = async (projectId) => {
    const snapshot = await db.collection('invoices')
        .where('projectDetails.projectId', '==', projectId)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};