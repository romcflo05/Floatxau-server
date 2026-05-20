const express = require('express');
const cors = require('cors');
const app = express();
 
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
 
let lastInvoiceNumber = 1011;
 
function calcMaterials(length, beam) {
  const dockLen = length + 1;
  const dockWid = beam + 1;
  const blocksLen = Math.round(dockLen / 0.5);
  const blocksWid = Math.round(dockWid / 0.5);
  const rollerBlocks = Math.round(1 / 0.5) * 2;
  const standardBlocks = (blocksLen * blocksWid) - rollerBlocks;
  const flatPins = Math.round(standardBlocks * 0.93);
  const bolts = Math.round(standardBlocks * 0.41);
  return {
    blocks: Math.max(0, standardBlocks),
    rollers: rollerBlocks,
    pins: flatPins,
    bolts: bolts
  };
}
 
function calcAirlift(weight) {
  if (weight < 2500) return 0;
  return Math.ceil((weight - 2500) / 900) + 1;
}
 
function formatDate(date) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
 
app.get('/', (req, res) => {
  res.json({ status: 'FloatXAU Quote Server is running' });
});
 
app.post('/wix-webhook', (req, res) => {
  try {
    const body = req.body;
    
    // Parse the submissions array from Wix
    let fields = {};
    if (body.data && body.data.submissions && Array.isArray(body.data.submissions)) {
      body.data.submissions.forEach(item => {
        // Trim whitespace and newlines from labels
        const label = item.label.trim();
        fields[label] = item.value;
      });
    }
 
    console.log('Parsed fields:', JSON.stringify(fields, null, 2));
 
    const name = fields['Full Name'] || '';
    const email = fields['Email'] || '';
    const phone = fields['Phone'] || '';
    const makeModel = fields['Make/Model'] || '';
    const boatLength = parseFloat(fields['Boat Length (m)']) || 0;
    const boatBeam = parseFloat(fields['Boat Width (m)']) || 0;
    const boatWeight = parseFloat(fields['Boat Weight (kg)']) || 0;
    const jettyType = fields['Jetty Type'] || '';
 
    console.log(`Name: ${name}, Email: ${email}, Length: ${boatLength}, Beam: ${boatBeam}, Weight: ${boatWeight}`);
 
    const mats = (boatLength && boatBeam) ? calcMaterials(boatLength, boatBeam) : { blocks: 0, rollers: 0, pins: 0, bolts: 0 };
    const airlift = boatWeight ? calcAirlift(boatWeight) : 0;
 
    lastInvoiceNumber += 1;
    const invoiceNumber = lastInvoiceNumber;
    const invoiceDate = formatDate(new Date());
 
    const quoteData = {
      name, email, phone, makeModel, jettyType,
      boatLength, boatBeam, boatWeight,
      blocks: mats.blocks,
      rollers: mats.rollers,
      pins: mats.pins,
      bolts: mats.bolts,
      airlift,
      invoiceNumber,
      invoiceDate
    };
 
    const encoded = Buffer.from(JSON.stringify(quoteData)).toString('base64');
    const baseUrl = process.env.BASE_URL || 'https://floatxau-server.onrender.com';
    const quoteUrl = `${baseUrl}/quote?data=${encoded}`;
 
    console.log(`New quote request from ${name} — Invoice #${invoiceNumber}`);
    console.log(`Quote URL: ${quoteUrl}`);
    console.log(`Materials: ${mats.blocks} blocks, ${mats.rollers} rollers, ${mats.pins} pins, ${mats.bolts} bolts, ${airlift} airlift`);
 
    res.json({ success: true, invoiceNumber, quoteData, quoteUrl });
 
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
 
app.get('/quote', (req, res) => {
  const data = req.query.data;
  let quoteData = {};
  
  try {
    if (data) {
      quoteData = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    }
  } catch(e) {
    console.error('Error parsing quote data:', e);
  }
 
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>FloatXAU Quote — ${quoteData.name || 'New Quote'}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, Arial, sans-serif; }
    body { background: #f5f5f5; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: #666; margin-bottom: 20px; }
    .card { background: white; border-radius: 10px; border: 1px solid #e5e5e5; padding: 20px; margin-bottom: 16px; }
    .card-title { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label { font-size: 12px; color: #666; }
    .field input { border: 1px solid #ddd; border-radius: 6px; padding: 8px 10px; font-size: 14px; width: 100%; }
    .field input:focus { outline: none; border-color: #111; }
    .airlift-warn { background: #fff8e6; border: 1px solid #f0c040; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: #8a6500; margin-top: 12px; }
    .btn-row { display: flex; gap: 10px; margin-top: 20px; }
    .btn-approve { background: #111; color: white; border: none; border-radius: 8px; padding: 12px 24px; font-size: 15px; font-weight: 500; cursor: pointer; flex: 2; }
    .btn-approve:hover { background: #333; }
    .btn-secondary { background: white; color: #111; border: 1px solid #ddd; border-radius: 8px; padding: 12px 24px; font-size: 15px; cursor: pointer; flex: 1; }
    .quote-preview { background: white; border-radius: 10px; border: 1px solid #e5e5e5; padding: 32px; margin-top: 20px; display: none; }
    .quote-preview.active { display: block; }
    .logo-box { background: #111; color: white; display: inline-block; padding: 4px 10px; font-weight: 900; font-size: 16px; letter-spacing: 1px; border-radius: 2px; margin-bottom: 8px; }
    .quote-title { font-size: 28px; font-weight: 900; margin-bottom: 16px; color: #111; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .info-table td { padding: 8px 10px; border: 1px solid #ddd; font-size: 12px; }
    .info-table .lbl { font-weight: 700; font-size: 11px; display: block; margin-bottom: 2px; }
    .inv-details { margin: 12px 0; font-size: 13px; }
    .inv-details p { margin: 2px 0; font-weight: 700; }
    .items-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
    .items-table th { background: #f5f5f5; text-align: left; padding: 8px 10px; border: 1px solid #ddd; font-size: 12px; }
    .items-table th:not(:first-child) { text-align: right; }
    .items-table td { padding: 7px 10px; border: 1px solid #ddd; }
    .items-table td:not(:first-child) { text-align: right; font-style: italic; }
    .totals-row td { background: #f5f5f5; font-weight: 700; }
    .total-row td { background: #e8e8e8; font-weight: 900; font-size: 14px; }
    .payment-title { font-size: 20px; font-weight: 900; margin: 16px 0 6px; }
    .payment-text { font-size: 11px; color: #555; margin-bottom: 10px; line-height: 1.5; }
    .bank-details { font-size: 12px; line-height: 1.9; }
    .fine-print { font-size: 10px; color: #777; font-style: italic; margin-top: 10px; }
  </style>
</head>
<body>
<div class="container">
  <h1>FloatXAU quote generator</h1>
  <p class="subtitle">Review and edit, then approve to download PDF.</p>
 
  <div class="card">
    <div class="card-title">Customer details</div>
    <div class="grid2" style="margin-bottom:12px;">
      <div class="field"><label>Full name</label><input type="text" id="custName" value="${quoteData.name || ''}" /></div>
      <div class="field"><label>Phone</label><input type="text" id="custPhone" value="${quoteData.phone || ''}" /></div>
    </div>
    <div class="field"><label>Email</label><input type="text" id="custEmail" value="${quoteData.email || ''}" /></div>
  </div>
 
  <div class="card">
    <div class="card-title">Invoice details</div>
    <div class="grid2">
      <div class="field"><label>Invoice number</label><input type="number" id="invNumber" value="${quoteData.invoiceNumber || ''}" /></div>
      <div class="field"><label>Invoice date</label><input type="text" id="invDate" value="${quoteData.invoiceDate || ''}" /></div>
    </div>
  </div>
 
  <div class="card">
    <div class="card-title">Calculated quantities — edit if needed</div>
    <div class="grid3" style="margin-bottom:12px;">
      <div class="field"><label>Single blocks</label><input type="number" id="blocks" value="${quoteData.blocks || 0}" /></div>
      <div class="field"><label>Roller blocks</label><input type="number" id="rollers" value="${quoteData.rollers || 0}" /></div>
      <div class="field"><label>Flat pins</label><input type="number" id="pins" value="${quoteData.pins || 0}" /></div>
    </div>
    <div class="grid3">
      <div class="field"><label>Bolts</label><input type="number" id="bolts" value="${quoteData.bolts || 0}" /></div>
      <div class="field"><label>Airlift units</label><input type="number" id="airlift" value="${quoteData.airlift || 0}" /></div>
      <div class="field"><label>Install fee (qty)</label><input type="number" id="install" value="1" /></div>
    </div>
    ${quoteData.airlift > 0 ? `<div class="airlift-warn">⚠ Airlift required — boat weight ${quoteData.boatWeight}kg (${quoteData.airlift} unit${quoteData.airlift > 1 ? 's' : ''})</div>` : ''}
  </div>
 
  <div class="card">
    <div class="card-title">Boat info (reference only)</div>
    <div class="grid3">
      <div class="field"><label>Make/Model</label><input type="text" value="${quoteData.makeModel || ''}" readonly style="background:#f9f9f9;" /></div>
      <div class="field"><label>Length × Beam</label><input type="text" value="${quoteData.boatLength || ''}m × ${quoteData.boatBeam || ''}m" readonly style="background:#f9f9f9;" /></div>
      <div class="field"><label>Weight</label><input type="text" value="${quoteData.boatWeight || ''}kg" readonly style="background:#f9f9f9;" /></div>
    </div>
  </div>
 
  <div class="btn-row">
    <button class="btn-secondary" onclick="previewQuote()">Preview quote</button>
    <button class="btn-approve" onclick="generatePDF()">✓ Approve & download PDF</button>
  </div>
 
  <div class="quote-preview" id="preview-box">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:14px;font-weight:600;">Quote preview</div>
      <button class="btn-secondary" onclick="closePreview()" style="padding:6px 14px;font-size:13px;">Close</button>
    </div>
    <div id="quote-render"></div>
  </div>
</div>
 
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script>
const PRICES = { blocks: 100, rollers: 200, pins: 25, bolts: 15, airlift: 5000, install: 1000 };
 
function getValues() {
  return {
    name: document.getElementById('custName').value,
    phone: document.getElementById('custPhone').value,
    email: document.getElementById('custEmail').value,
    invNumber: document.getElementById('invNumber').value,
    invDate: document.getElementById('invDate').value,
    blocks: parseInt(document.getElementById('blocks').value) || 0,
    rollers: parseInt(document.getElementById('rollers').value) || 0,
    pins: parseInt(document.getElementById('pins').value) || 0,
    bolts: parseInt(document.getElementById('bolts').value) || 0,
    airlift: parseInt(document.getElementById('airlift').value) || 0,
    install: parseInt(document.getElementById('install').value) || 1,
  };
}
 
function fmt(n) { return '$' + n.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}); }
 
function calcTotals(v) {
  const subtotal = (v.blocks*PRICES.blocks)+(v.rollers*PRICES.rollers)+(v.pins*PRICES.pins)+(v.bolts*PRICES.bolts)+(v.airlift*PRICES.airlift)+(v.install*PRICES.install);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;
  const deposit = total * 0.3;
  return { subtotal, gst, total, deposit };
}
 
function buildQuoteHTML(v) {
  const t = calcTotals(v);
  return \`
    <div class="logo-box">FLOATX</div>
    <div class="quote-title">Quote</div>
    <table class="info-table">
      <tr>
        <td style="width:50%"><span class="lbl">NAME</span>Rohan Baldwin</td>
        <td style="width:50%"><span class="lbl">BILLED TO</span>\${v.name}</td>
      </tr>
      <tr>
        <td><span class="lbl">CONTACT NUMBER</span>0447077414</td>
        <td><span class="lbl">CONTACT NUMBER</span>\${v.phone}</td>
      </tr>
      <tr>
        <td><span class="lbl">EMAIL ADDRESS</span>contact@floatxau.com</td>
        <td><span class="lbl">EMAIL ADDRESS</span>\${v.email}</td>
      </tr>
    </table>
    <div class="inv-details">
      <p>Invoice Date: \${v.invDate}</p>
      <p>Invoice Number: #\${v.invNumber}</p>
    </div>
    <table class="items-table">
      <thead><tr><th>Item</th><th>Quantity</th><th>Cost/Unit</th><th>Subtotal</th></tr></thead>
      <tbody>
        <tr><td>Single Blocks</td><td>\${v.blocks}</td><td>\${fmt(PRICES.blocks)}</td><td>\${fmt(v.blocks*PRICES.blocks)}</td></tr>
        <tr><td>Roller Blocks</td><td>\${v.rollers}</td><td>\${fmt(PRICES.rollers)}</td><td>\${fmt(v.rollers*PRICES.rollers)}</td></tr>
        <tr><td>Flat Pins</td><td>\${v.pins}</td><td>\${fmt(PRICES.pins)}</td><td>\${fmt(v.pins*PRICES.pins)}</td></tr>
        <tr><td>Bolts</td><td>\${v.bolts}</td><td>\${fmt(PRICES.bolts)}</td><td>\${fmt(v.bolts*PRICES.bolts)}</td></tr>
        <tr><td>Airlift</td><td>\${v.airlift}</td><td>\${fmt(PRICES.airlift)}</td><td>\${fmt(v.airlift*PRICES.airlift)}</td></tr>
        <tr><td>Install Fee</td><td>\${v.install}</td><td>\${fmt(PRICES.install)}</td><td>\${fmt(v.install*PRICES.install)}</td></tr>
        <tr class="totals-row"><td></td><td></td><td>SUBTOTAL (AUD)</td><td>\${fmt(t.subtotal)}</td></tr>
        <tr class="totals-row"><td></td><td></td><td>GST (10%)</td><td>\${fmt(t.gst)}</td></tr>
        <tr class="total-row"><td></td><td></td><td><b>TOTAL AMOUNT (AUD)</b></td><td><b>\${fmt(t.total)}</b></td></tr>
        <tr class="totals-row"><td></td><td></td><td>Deposit (30%)</td><td>\${fmt(t.deposit)}</td></tr>
      </tbody>
    </table>
    <div class="payment-title">Payment Details</div>
    <div class="payment-text">Please make payment for the deposit within 7 days of the invoice date using the following bank information. The remaining amount will be invoiced upon delivery.</div>
    <div class="bank-details">
      ACCOUNT NAME: Rohan Baldwin<br>
      BSB: 774-001<br>
      ACCOUNT NUMBER: 214595067<br>
      REFERENCE: \${v.invNumber}<br>
      ABN: 32 655 285 406
    </div>
    <div class="fine-print">I confirm that if installation does not occur within 60 days of receipt of the deposit, the deposit shall be fully refunded.</div>
  \`;
}
 
function previewQuote() {
  const v = getValues();
  document.getElementById('quote-render').innerHTML = buildQuoteHTML(v);
  document.getElementById('preview-box').classList.add('active');
  document.getElementById('preview-box').scrollIntoView({behavior:'smooth'});
}
 
function closePreview() {
  document.getElementById('preview-box').classList.remove('active');
}
 
function generatePDF() {
  const v = getValues();
  const t = calcTotals(v);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 20;
  let y = 20;
 
  doc.setFillColor(17,17,17);
  doc.rect(M, y, 28, 8, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(10);
  doc.setFont('helvetica','bold');
  doc.text('FLOATX', M+4, y+5.5);
  y += 14;
 
  doc.setTextColor(17,17,17);
  doc.setFontSize(24);
  doc.text('Quote', M, y);
  y += 10;
 
  const hw = (W - M*2) / 2;
  const infoRows = [
    ['NAME', 'Rohan Baldwin', 'BILLED TO', v.name],
    ['CONTACT NUMBER', '0447077414', 'CONTACT NUMBER', v.phone],
    ['EMAIL ADDRESS', 'contact@floatxau.com', 'EMAIL ADDRESS', v.email],
  ];
  doc.setFontSize(9);
  infoRows.forEach(row => {
    doc.setDrawColor(200,200,200);
    doc.rect(M, y, hw, 12);
    doc.rect(M+hw, y, hw, 12);
    doc.setFont('helvetica','bold');
    doc.setFontSize(8);
    doc.text(row[0], M+2, y+4);
    doc.text(row[2], M+hw+2, y+4);
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.text(row[1], M+2, y+9);
    doc.text(String(row[3]), M+hw+2, y+9);
    y += 12;
  });
 
  y += 5;
  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.text('Invoice Date: ' + v.invDate, M, y); y+=6;
  doc.text('Invoice Number: #' + v.invNumber, M, y); y+=8;
 
  const cols = [80,30,35,35];
  const headers = ['Item','Quantity','Cost/Unit','Subtotal'];
  doc.setFillColor(240,240,240);
  doc.rect(M, y, W-M*2, 8, 'F');
  doc.setFont('helvetica','bold');
  doc.setFontSize(9);
  let x = M;
  headers.forEach((h,i) => { doc.text(h, x+2, y+5.5); x+=cols[i]; });
  y += 8;
 
  const items = [
    ['Single Blocks', v.blocks, PRICES.blocks, v.blocks*PRICES.blocks],
    ['Roller Blocks', v.rollers, PRICES.rollers, v.rollers*PRICES.rollers],
    ['Flat Pins', v.pins, PRICES.pins, v.pins*PRICES.pins],
    ['Bolts', v.bolts, PRICES.bolts, v.bolts*PRICES.bolts],
    ['Airlift', v.airlift, PRICES.airlift, v.airlift*PRICES.airlift],
    ['Install Fee', v.install, PRICES.install, v.install*PRICES.install],
  ];
 
  doc.setFont('helvetica','normal');
  items.forEach(item => {
    doc.setDrawColor(220,220,220);
    doc.rect(M, y, W-M*2, 8);
    x = M;
    doc.text(String(item[0]), x+2, y+5.5); x+=cols[0];
    doc.text(String(item[1]), x+2, y+5.5); x+=cols[1];
    doc.text(fmt(item[2]), x+2, y+5.5); x+=cols[2];
    doc.text(fmt(item[3]), x+2, y+5.5);
    y += 8;
  });
 
  const summaryRows = [
    ['SUBTOTAL (AUD)', fmt(t.subtotal), false],
    ['GST (10%)', fmt(t.gst), false],
    ['TOTAL AMOUNT (AUD)', fmt(t.total), true],
    ['Deposit (30%)', fmt(t.deposit), false],
  ];
  summaryRows.forEach(row => {
    doc.setFillColor(row[2] ? 220 : 240, row[2] ? 220 : 240, row[2] ? 220 : 240);
    doc.rect(M, y, W-M*2, 8, 'F');
    doc.setDrawColor(200,200,200);
    doc.rect(M, y, W-M*2, 8);
    doc.setFont('helvetica', row[2] ? 'bold' : 'normal');
    doc.setFontSize(row[2] ? 10 : 9);
    doc.text(row[0], M+cols[0]+cols[1]+2, y+5.5);
    doc.text(row[1], M+cols[0]+cols[1]+cols[2]+2, y+5.5);
    y += 8;
  });
 
  y += 8;
  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.text('Payment Details', M, y); y+=7;
  doc.setFont('helvetica','normal');
  doc.setFontSize(8.5);
  const payText = 'Please make payment for the deposit within 7 days of the invoice date using the following bank information. The remaining amount will be invoiced upon delivery.';
  const lines = doc.splitTextToSize(payText, W-M*2);
  doc.text(lines, M, y); y += lines.length * 5 + 4;
 
  doc.setFontSize(9);
  ['ACCOUNT NAME: Rohan Baldwin','BSB: 774-001','ACCOUNT NUMBER: 214595067',\`REFERENCE: \${v.invNumber}\`,'ABN: 32 655 285 406'].forEach(line => {
    doc.text(line, M, y); y+=5;
  });
 
  y+=4;
  doc.setFontSize(8);
  doc.setTextColor(120,120,120);
  const fineLines = doc.splitTextToSize('I confirm that if installation does not occur within 60 days of receipt of the deposit, the deposit shall be fully refunded.', W-M*2);
  doc.text(fineLines, M, y);
 
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const dateStr = now.getDate() + months[now.getMonth()];
  const filename = v.name.replace(/\s+/g,'_') + '_Quote_' + dateStr + '.pdf';
  doc.save(filename);
}
</script>
</body>
</html>`);
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FloatXAU Quote Server running on port ${PORT}`);
});
 
