const PDFDocument = require('pdfkit');

// ==========================================
// 1. PROGRESS REPORT (Existing Logic - Unchanged)
// ==========================================
exports.generateBulkReportPDF = async (reports, res, title) => {
    try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        doc.pipe(res);
        doc.fillColor('#1a5f7a').fontSize(22).text('SITework ERP System', { align: 'center' });
        doc.fontSize(14).fillColor('#333').text(title, { align: 'center' });
        doc.fontSize(10).fillColor('grey').text(`Report Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'right' });
        doc.moveDown();
        doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        reports.forEach((item, index) => {
            if (doc.y > 600) doc.addPage();
            doc.fillColor('#1a5f7a').fontSize(12).text(`ENTRY #${reports.length - index} | DATE: ${item.date}`, { underline: true });
            doc.moveDown(0.5);
            doc.fillColor('black').fontSize(10);
            doc.font('Helvetica-Bold').text('Work Status:');
            doc.font('Helvetica').text(`• Yesterday: ${item.workDetails?.yesterdayWork || 'N/A'}`);
            doc.font('Helvetica').text(`• Today: ${item.workDetails?.todayWork || 'N/A'}`);
            doc.font('Helvetica').text(`• Tomorrow Plan: ${item.workDetails?.nextDayWork || 'N/A'}`);
            const progress = item.progressUpdatePercentage || 0;
            doc.fillColor('#e67e22').text(`• Project Progress: ${progress}% completed`);
            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').text('Resources & Finance:');
            doc.font('Helvetica').text(`• Labour: Skilled(${item.resources?.labour?.skilled || 0}) | Unskilled(${item.resources?.labour?.unskilled || 0})`);
            doc.font('Helvetica').text(`• Daily Expense: Rs. ${item.financials?.dailyExpense || 0}`);
            doc.moveDown();
            doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#eeeeee').stroke();
            doc.moveDown();
        });
        doc.end();
    } catch (error) { console.error("PDF Error:", error); }
};

// ==========================================
// 2. PROFESSIONAL INVOICE (Existing Logic - Unchanged)
// ==========================================
exports.generateInvoicePDF = async (data, res) => {
    try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        doc.pipe(res);
        doc.fillColor('#1a5f7a').fontSize(20).text(data.companyDetails?.name || 'COMPANY NAME', 40, 40);
        doc.fillColor('#1a5f7a').fontSize(25).text('INVOICE', 400, 40, { align: 'right' });
        doc.moveTo(40, 110).lineTo(550, 110).stroke('#1a5f7a');

        // Items Table
        const tableTop = 220;
        doc.rect(40, tableTop, 510, 20).fill('#1a5f7a');
        doc.fillColor('white').fontSize(10).text('Description', 50, tableTop + 5).text('Total', 480, tableTop + 5);

        let currentY = tableTop + 30;
        doc.fillColor('black');
        (data.items || []).forEach(item => {
            doc.text(item.description, 50, currentY);
            doc.text(item.totalAmount.toLocaleString(), 480, currentY);
            currentY += 25;
        });
        doc.end();
    } catch (e) { console.error(e); }
};

// ==========================================
// 3. PLAN APPROVAL (UPDATED FOR FULL DATA)
// ==========================================
exports.generateApprovalCaseFilePDF = (data, res) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            doc.on('error', reject);
            doc.pipe(res);

            const primaryColor = '#003366';
            const secondaryColor = '#2c3e50';

            // --- 1. Header ---
            doc.rect(0, 0, 600, 80).fill(primaryColor);
            doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('PLAN APPROVAL CASE RECORD', 40, 30);
            doc.fontSize(10).font('Helvetica').text(`REF: ${data.refNo} | Generated: ${new Date().toLocaleDateString()}`, 40, 55);

            // --- 2. Project Details (Exactly matching your JSON fields) ---
            doc.moveDown(4);
            doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text('PROJECT & SITE SPECIFICATIONS');
            doc.moveTo(40, doc.y + 2).lineTo(550, doc.y + 2).stroke('#ccc');
            doc.moveDown(1);

            const drawField = (label, value, x, y) => {
                doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(10).text(label, x, y);
                doc.fillColor('black').font('Helvetica').text(String(value || 'N/A'), x + 90, y);
            };

            let currentY = doc.y;
            drawField('Applicant:', data.applicantName, 40, currentY);
            drawField('Location:', data.projectLocation, 300, currentY);

            currentY += 20;
            drawField('Plot Size:', data.plotSize, 40, currentY);
            drawField('Survey No:', data.siteDetails?.surveyNo, 300, currentY);

            currentY += 20;
            drawField('Floors:', data.buildingFloors, 40, currentY);
            drawField('In-Charge:', data.inCharge?.name, 300, currentY);

            // --- 3. Financial Summary (Dynamic Calculation) ---
            doc.moveDown(3);
            doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text('FINANCIAL SUMMARY');

            const totalFees = Number(data.financials?.totalFees || 0);
            const initialPaid = Number(data.financials?.initialPaid || 0);
            // Calculating total from subsequent payments array
            const subsequentSum = (data.financials?.subsequentPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const totalPaid = initialPaid + subsequentSum;
            const balance = totalFees - totalPaid;

            doc.rect(40, doc.y + 5, 510, 45).fill('#f9f9f9').stroke('#ddd');
            const finY = doc.y + 15;
            doc.fillColor('black').fontSize(9).text('TOTAL FEES', 60, finY);
            doc.text('TOTAL PAID', 240, finY).text('BALANCE DUE', 430, finY);

            doc.fontSize(11).font('Helvetica-Bold').text(`Rs. ${totalFees.toLocaleString()}`, 60, finY + 15);
            doc.fillColor('#27ae60').text(`Rs. ${totalPaid.toLocaleString()}`, 240, finY + 15);
            doc.fillColor('#c0392b').text(`Rs. ${balance.toLocaleString()}`, 430, finY + 15);

            // --- 4. Document Verification Checklist ---
            doc.moveDown(3);
            doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text('DOCUMENT VERIFICATION');
            doc.moveDown(0.5);
            if (data.documentVerification?.checklist) {
                data.documentVerification.checklist.forEach(item => {
                    const isOk = item.status === 'Verified';
                    doc.fillColor(isOk ? '#27ae60' : '#c0392b').fontSize(9)
                        .text(`${isOk ? '[OK]' : '[MISSING]'} ${item.docName}`, 50);
                });
            }

            // --- 5. Progress History ---
            doc.moveDown(2);
            doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text('HISTORY & REMARKS');
            doc.moveDown(0.5);
            if (data.statusTracking?.history) {
                data.statusTracking.history.forEach(h => {
                    const dateStr = new Date(h.date).toLocaleDateString();
                    doc.fillColor('black').fontSize(9).font('Helvetica-Bold').text(`${dateStr} - ${h.status}`, 50);
                    doc.font('Helvetica').fillColor('#555').text(`Note: ${h.remarks || 'No remarks'}`, 60);
                    doc.moveDown(0.3);
                });
            }

            // Footer
            doc.fontSize(8).fillColor('grey').text('SITework ERP - High Priority Commercial Project', 40, 780, { align: 'center' });

            doc.end();
            doc.on('end', () => resolve());
        } catch (error) { reject(error); }
    });
};


// ==========================================
// 4. PROJECT INVOICE PDF
// Called by: projectController.downloadProjectInvoice
// ==========================================
exports.generateProjectInvoicePDF = (projectData, res) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            doc.on('error', reject);
            doc.pipe(res);

            const PRIMARY = '#1a3c5e';
            const ACCENT = '#e67e22';
            const LIGHT = '#f4f6f8';
            const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN');

            // ── HEADER BANNER ───────────────────────────────────────────
            doc.rect(0, 0, 612, 90).fill(PRIMARY);
            doc.fillColor('white')
                .fontSize(22).font('Helvetica-Bold').text('VV CONSTRUCTION', 50, 25);
            doc.fontSize(10).font('Helvetica').text('Project Invoice & Financial Summary', 50, 52);
            doc.fontSize(9)
                .text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 400, 35, { align: 'right', width: 162 })
                .text(`Project Code: ${projectData.projectCode || 'N/A'}`, 400, 50, { align: 'right', width: 162 });

            // ── PROJECT TITLE STRIP ─────────────────────────────────────
            doc.rect(0, 90, 612, 35).fill(ACCENT);
            doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
                .text(projectData.projectName || 'Untitled Project', 50, 100, { width: 500, align: 'center' });

            // ── PROJECT DETAILS ─────────────────────────────────────────
            let y = 148;
            const drawTwoCol = (l1, v1, l2, v2) => {
                doc.fillColor('#555').fontSize(9).font('Helvetica-Bold').text(l1, 50, y).text(l2, 320, y);
                doc.fillColor('black').font('Helvetica').text(String(v1 || 'N/A'), 160, y).text(String(v2 || 'N/A'), 430, y);
                y += 18;
            };

            doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('PROJECT DETAILS', 50, y);
            doc.moveTo(50, y + 14).lineTo(562, y + 14).lineWidth(0.5).strokeColor('#ccc').stroke();
            y += 22;
            drawTwoCol('Status', projectData.status, 'Priority', projectData.priority);
            drawTwoCol('Progress', `${projectData.progressPercentage || 0}%`, 'Risk Level', projectData.riskLevel);
            drawTwoCol('Start Date', projectData.startDate, 'End Date', projectData.endDate);
            drawTwoCol('City', projectData.location?.city, 'State', projectData.location?.state);

            // ── CLIENT DETAILS ──────────────────────────────────────────
            y += 10;
            doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('CLIENT DETAILS', 50, y);
            doc.moveTo(50, y + 14).lineTo(562, y + 14).lineWidth(0.5).strokeColor('#ccc').stroke();
            y += 22;
            const cl = projectData.clientDetails || {};
            drawTwoCol('Client Name', cl.clientName, 'Type', cl.clientType);
            drawTwoCol('Contact', cl.clientContact, 'Email', cl.clientEmail);
            drawTwoCol('Address', cl.clientAddress, '', '');

            // ── FINANCIAL SUMMARY ───────────────────────────────────────
            y += 10;
            doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('FINANCIAL SUMMARY', 50, y);
            doc.moveTo(50, y + 14).lineTo(562, y + 14).lineWidth(0.5).strokeColor('#ccc').stroke();
            y += 22;

            const fin = projectData.financials || {};

            doc.rect(50, y, 512, 22).fill(PRIMARY);
            doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
                .text('DESCRIPTION', 60, y + 6)
                .text('AMOUNT (Rs.)', 430, y + 6, { width: 120, align: 'right' });
            y += 22;

            const drawRow = (label, value, shade) => {
                if (shade) doc.rect(50, y, 512, 20).fill(LIGHT);
                doc.fillColor('#333').font('Helvetica').fontSize(9).text(label, 60, y + 5);
                doc.fillColor('black').font('Helvetica-Bold').text(fmt(value), 430, y + 5, { width: 120, align: 'right' });
                y += 20;
            };

            drawRow('Total Project Budget', fin.budget?.totalProjectBudget, false);
            drawRow('Estimated Project Cost', fin.budget?.estimatedProjectCost, true);
            drawRow('Total Amount Spent', fin.expenses?.totalSpentAmount, false);
            drawRow('Remaining Budget', fin.expenses?.remainingBudget, true);
            drawRow('Total Received from Client', fin.clientPayments?.totalAmountReceived, false);
            drawRow('Remaining to Receive', fin.clientPayments?.remainingAmountToReceive, true);

            y += 5;
            doc.rect(50, y, 512, 28).fill(PRIMARY);
            doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
                .text('EXPECTED PROFIT', 60, y + 8)
                .text(`Rs. ${fmt(fin.profit?.expectedProfit)}`, 300, y + 8, { width: 250, align: 'right' });
            y += 28;
            doc.rect(50, y, 512, 28).fill(ACCENT);
            doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
                .text('CURRENT PROFIT', 60, y + 8)
                .text(`Rs. ${fmt(fin.profit?.currentProfit)}`, 300, y + 8, { width: 250, align: 'right' });
            y += 36;

            const payStatus = fin.clientPayments?.paymentStatus || 'Pending';
            const statusColor = payStatus === 'Paid' ? '#27ae60' : payStatus === 'Partial' ? '#e67e22' : '#c0392b';
            doc.rect(50, y, 512, 28).fill(statusColor);
            doc.fillColor('white').font('Helvetica-Bold').fontSize(11)
                .text(`PAYMENT STATUS: ${payStatus.toUpperCase()}`, 50, y + 8, { align: 'center', width: 512 });
            y += 38;

            // ── CONSTRUCTION DETAILS ────────────────────────────────────
            if (y < 710) {
                doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('CONSTRUCTION DETAILS', 50, y);
                doc.moveTo(50, y + 14).lineTo(562, y + 14).lineWidth(0.5).strokeColor('#ccc').stroke();
                y += 22;
                const cd = projectData.constructionDetails || {};
                drawTwoCol('Total Units', String(cd.totalUnits || 0), 'Total Floors', String(cd.totalFloors || 0));
                drawTwoCol('Built-Up Area', `${cd.builtUpAreaSqft || 0} sqft`, 'Labour Count', String(cd.labourCount || 0));
                drawTwoCol('Approval', cd.approvalStatus, 'Theme', cd.constructionTheme);
            }

            // ── FOOTER ──────────────────────────────────────────────────
            doc.fontSize(8).fillColor('grey')
                .text('VV Construction ERP — Confidential Project Document', 50, 810, { align: 'center', width: 512 });

            doc.end();
            doc.on('end', () => resolve());
        } catch (err) {
            reject(err);
        }
    });
};
