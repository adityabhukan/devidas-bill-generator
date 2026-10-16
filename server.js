
const express = require('express');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC));

const esc = (v = '') =>
  String(v).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  }[c]));

const money = n =>
  Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

function today() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const d = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${d.year}-${d.month}-${d.day}`;
}

const counterPath = path.join(__dirname, 'bill-counter.json');

function nextBillMeta() {
  const year = today().slice(0, 4);
  let counter = { year, lastNumber: 0 };

  try {
    counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
  } catch (_) {}

  if (String(counter.year) !== year) {
    counter = { year, lastNumber: 0 };
  }

  counter.lastNumber = Number(counter.lastNumber || 0) + 1;

  fs.writeFileSync(counterPath, JSON.stringify(counter, null, 2));

  return {
    billNo: `DHS-${year}-${String(counter.lastNumber).padStart(3, '0')}`,
    date: today()
  };
}

function readAsset(name) {
  const file = path.join(PUBLIC, name);
  if (!fs.existsSync(file)) return '';
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}

// Extract quantity from labels such as "30 DAYS", "5 HOURS" or "2".
function quantityFromLabel(label) {
  const match = String(label || '').trim().match(/^(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 1;
}

function billSvg(d) {
  const logo = readAsset('logo.png');
  const signature = readAsset('signature.png');

  const items = d.items.map(item => {
    const qtyLabel = String(item.qtyLabel || '').trim();
    const qty = quantityFromLabel(qtyLabel);
    const rate = Math.max(0, Number(item.rate) || 0);

    return {
      particulars: esc(item.particulars || 'Service'),
      qtyText: esc(qtyLabel),
      rate,
      amount: qty * rate
    };
  });

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const advance = Math.max(0, Number(d.advance) || 0);
  const balance = total - advance;

  const billNo = esc(d.billNo || '');
  const date = esc(d.date || today());
  const name = esc(d.name || '');
  const address = esc(d.address || '');

  const firstRowY = 526;
  const rowHeight = 32;
  const tableBottom = Math.max(
    918,
    firstRowY + items.length * rowHeight + 150
  );

  const footerY = tableBottom + 35;
  const svgHeight = Math.max(1123, footerY + 155);

  const itemRows = items.map((item, i) => {
    const y = firstRowY + i * rowHeight;

    return `
      <text x="74" y="${y}" text-anchor="middle" font-size="13">${i + 1}</text>
      <text x="125" y="${y}" font-size="13">${item.particulars}</text>
      <text x="487" y="${y}" text-anchor="middle" font-size="13">${item.qtyText}</text>
      <text x="572" y="${y}" text-anchor="middle" font-size="13">${money(item.rate)}</text>
      <text x="705" y="${y}" text-anchor="middle" font-size="13">${money(item.amount)}</text>
    `;
  }).join('');

  const advanceY = tableBottom - 115;
  const balanceY = tableBottom - 70;
  const totalY = tableBottom - 25;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
 width="794" height="${svgHeight}"
 viewBox="0 0 794 ${svgHeight}">
<rect width="794" height="${svgHeight}" fill="white"/>

<g font-family="Arial, Helvetica, sans-serif" fill="#111">

${logo ? `<image href="${logo}" x="20" y="95" width="107" height="103"/>` : ''}

<text x="430" y="126" text-anchor="middle"
 font-family="Georgia,serif" font-size="31">DEVIDAS HEALTHCARE SERVICES</text>

<text x="690" y="52" text-anchor="middle" font-size="14">Mobile: 9224471242</text>
<text x="690" y="84" text-anchor="middle" font-size="14">9821548685</text>
<text x="430" y="157" text-anchor="middle" font-size="14">Reg.No.: E-11725/Thane</text>
<text x="430" y="181" text-anchor="middle" font-size="14">Male &amp; Female Attendant, Qualified Nurses, Baby Care</text>
<text x="430" y="204" text-anchor="middle" font-size="14">WE CARE TAKERS FOR PATIENT HOSPITAL &amp; HOME PROVIDER</text>

<line x1="0" y1="224" x2="794" y2="224" stroke="#555"/>
<text x="96" y="240" font-size="14">Add:- A-Wing 206, Satyam Prestige CHS, Plot No. 14 Sector 4, Karnjade, Panvel-410206</text>
<text x="96" y="263" font-size="14">Email: devidaspandirkar786@gmail.com</text>

<rect x="35" y="279" width="724" height="145" rx="25"
 fill="none" stroke="#111" stroke-width="1.5"/>

<text x="60" y="334" font-size="14">Bill No. :-</text>
<text x="130" y="334" font-size="14">${billNo}</text>
<line x1="126" y1="339" x2="350" y2="339" stroke="#444"/>

<text x="585" y="334" font-size="14">Date:</text>
<text x="634" y="334" font-size="14">${date}</text>
<line x1="630" y1="339" x2="735" y2="339" stroke="#444"/>

<text x="60" y="373" font-size="14">Name :-</text>
<text x="130" y="373" font-size="14">${name}</text>
<line x1="126" y1="378" x2="735" y2="378" stroke="#444"/>

<text x="60" y="412" font-size="14">Add :-</text>
<text x="130" y="412" font-size="14">${address}</text>
<line x1="105" y1="417" x2="735" y2="417" stroke="#444"/>

<rect x="32" y="448" width="764" height="${tableBottom - 448}"
 fill="none" stroke="#111"/>
<line x1="115" y1="448" x2="115" y2="${tableBottom}" stroke="#111"/>
<line x1="445" y1="448" x2="445" y2="${tableBottom}" stroke="#111"/>
<line x1="530" y1="448" x2="530" y2="${tableBottom}" stroke="#111"/>
<line x1="615" y1="448" x2="615" y2="${tableBottom}" stroke="#111"/>
<line x1="32" y1="491" x2="796" y2="491" stroke="#111"/>

<text x="74" y="465" text-anchor="middle" font-size="14">Sr.</text>
<text x="74" y="483" text-anchor="middle" font-size="14">No.</text>
<text x="280" y="474" text-anchor="middle" font-size="14">PARTICULARS</text>
<text x="487" y="474" text-anchor="middle" font-size="14">Qty.</text>
<text x="572" y="474" text-anchor="middle" font-size="14">Rate</text>
<text x="705" y="465" text-anchor="middle" font-size="14">Amount</text>
<text x="705" y="483" text-anchor="middle" font-size="14">RS. P.</text>

${itemRows}

<line x1="530" y1="${advanceY - 28}" x2="796" y2="${advanceY - 28}" stroke="#111"/>
<line x1="530" y1="${balanceY - 28}" x2="796" y2="${balanceY - 28}" stroke="#111"/>
<line x1="530" y1="${totalY - 28}" x2="796" y2="${totalY - 28}" stroke="#111"/>

<text x="548" y="${advanceY}" font-size="14">Adv.</text>
<text x="704" y="${advanceY}" text-anchor="middle" font-size="14">${money(advance)}</text>
<text x="548" y="${balanceY}" font-size="14">Bal.</text>
<text x="704" y="${balanceY}" text-anchor="middle" font-size="14">${money(balance)}</text>
<text x="548" y="${totalY}" font-size="14">Total</text>
<text x="704" y="${totalY}" text-anchor="middle" font-size="14">${money(balance)}</text>

<text x="774" y="${footerY}" text-anchor="end" font-size="14">For DEVIDAS HEALTHCARE SERVICES</text>
${signature ? `<image href="${signature}" x="535" y="${footerY + 10}" width="190" height="48"/>` : ''}
<text x="48" y="${footerY + 72}" font-size="14">Receiver Signature</text>
<text x="646" y="${footerY + 100}" text-anchor="middle" font-size="14">Proprietor</text>

</g></svg>`;
}

app.get('/', (_req, res) => res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Devidas Healthcare Bill</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f2f4f7;font-family:Arial,sans-serif;color:#1d2430}
.wrap{max-width:900px;margin:24px auto;padding:18px}
.panel{background:white;border-radius:14px;padding:22px;box-shadow:0 4px 20px #15223812}
h1{font-size:23px;margin:0 0 6px}
p{color:#667085}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
label{display:block;font-size:13px;font-weight:bold;margin-bottom:6px}
input{width:100%;padding:11px;border:1px solid #cfd5df;border-radius:8px;font:inherit;min-width:0}
.full{grid-column:1/-1}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
button{border:0;border-radius:8px;padding:12px 16px;font-weight:bold;cursor:pointer;background:#135dcc;color:white}
.secondary{background:#e9eef7;color:#1d2430}
#preview{display:none;width:100%;margin-top:20px;border:1px solid #d8dee8}
.hint{font-size:12px}
.item-row{display:grid;grid-template-columns:minmax(150px,2fr) minmax(110px,1fr) minmax(110px,1fr) auto;gap:8px;margin-bottom:12px;align-items:end}
.item-row button{padding:10px}
@media(max-width:650px){
 .grid{grid-template-columns:1fr}
 .full{grid-column:auto}
 .wrap{padding:10px}
 .panel{padding:15px}
 .item-row{grid-template-columns:1fr 1fr}
 .item-row>div:first-child{grid-column:1/-1}
 .item-row .remove-item{grid-column:1/-1}
}
</style>
</head>
<body>
<div class="wrap"><div class="panel">
<h1>DEVIDAS HEALTHCARE SERVICES</h1>
<p>Create a bill with multiple services.</p>

<form id="billForm">
<div class="grid">

<div>
<label for="billNoDisplay">Bill number (editable)</label>
<input id="billNoDisplay" name="billNo" type="text"
 placeholder="Auto-generated if blank">
</div>

<div>
<label for="dateDisplay">Date (calendar)</label>
<input id="dateDisplay" name="date" type="date" required>
</div>

<div>
<label for="customerName">Customer / Patient name</label>
<input id="customerName" name="name" placeholder="Enter name" required>
</div>

<div>
<label for="customerAddress">Address</label>
<input id="customerAddress" name="address" placeholder="Enter address" required>
</div>

<div class="full">
<label>Particulars / Services</label>
<div id="items"></div>
<button type="button" class="secondary" id="addItem">+ Add Particular</button>
</div>

<div>
<label for="advance">Advance paid (₹)</label>
<input id="advance" name="advance" type="number" min="0"
 step="0.01" value="0" required>
</div>

</div>

<div class="actions">
<button type="submit">Generate bill image</button>
<button type="button" class="secondary" id="download" disabled>Download PNG</button>
<button type="button" class="secondary" id="share" disabled>Share</button>
</div>
<p class="hint">On supported phones, use Share to send the bill through WhatsApp.</p>
</form>

<img id="preview" alt="Generated bill preview">
</div></div>

<script>
const form = document.getElementById('billForm');
const preview = document.getElementById('preview');
const download = document.getElementById('download');
const share = document.getElementById('share');
const billNoDisplay = document.getElementById('billNoDisplay');
const dateDisplay = document.getElementById('dateDisplay');
const itemsContainer = document.getElementById('items');
const addItemButton = document.getElementById('addItem');

let blob = null;
let previewUrl = null;

function indiaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const d = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return d.year + '-' + d.month + '-' + d.day;
}

dateDisplay.value = indiaToday();

function addItemRow(particulars = '', qtyLabel = '', rate = '0') {
  const row = document.createElement('div');
  row.className = 'item-row';

  const fields = [
    ['Particulars', 'item-particulars', particulars, 'Service name'],
    ['Qty. Label', 'item-qty-label', qtyLabel, 'e.g. 30 DAYS'],
    ['Rate (₹)', 'item-rate', rate, '']
  ];

  for (const [labelText, className, value, placeholder] of fields) {
    const wrapper = document.createElement('div');
    const label = document.createElement('label');
    label.textContent = labelText;

    const input = document.createElement('input');
    input.className = className;
    input.value = value;
    input.placeholder = placeholder;

    if (className === 'item-rate') {
      input.type = 'number';
      input.min = '0';
      input.step = '0.01';
      input.required = true;
    } else {
      input.type = 'text';
      input.required = true;
    }

    wrapper.append(label, input);
    row.appendChild(wrapper);
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'secondary remove-item';
  remove.textContent = 'Remove';

  remove.addEventListener('click', () => {
    if (itemsContainer.children.length > 1) {
      row.remove();
    } else {
      alert('At least one particular is required.');
    }
  });

  row.appendChild(remove);
  itemsContainer.appendChild(row);
}

addItemButton.addEventListener('click', () => addItemRow());
addItemRow('Male Attendant', '30 DAYS', '700');

form.addEventListener('submit', async e => {
  e.preventDefault();

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const data = Object.fromEntries(new FormData(form).entries());

    data.items = Array.from(
      itemsContainer.querySelectorAll('.item-row')
    ).map(row => ({
      particulars: row.querySelector('.item-particulars').value,
      qtyLabel: row.querySelector('.item-qty-label').value,
      rate: row.querySelector('.item-rate').value
    }));

    const response = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      alert(error.error || 'Bill generation failed. Check the server terminal.');
      return;
    }

    blob = await response.blob();

    billNoDisplay.value = response.headers.get('X-Bill-No') || data.billNo;
    dateDisplay.value = response.headers.get('X-Bill-Date') || data.date;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);

    preview.src = previewUrl;
    preview.style.display = 'block';
    download.disabled = false;
    share.disabled = false;
  } catch (error) {
    console.error(error);
    alert('Could not connect to the server.');
  } finally {
    submitButton.disabled = false;
  }
});

download.addEventListener('click', () => {
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'devidas-bill.png';
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

share.addEventListener('click', async () => {
  if (!blob) return;

  const file = new File([blob], 'devidas-bill.png', {
    type: 'image/png'
  });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Devidas Healthcare Bill'
      });
    } catch (error) {
      if (error.name !== 'AbortError') console.error(error);
    }
  } else {
    alert('Sharing is not supported here. Download the PNG and attach it in WhatsApp.');
  }
});
</script>
</body>
</html>`));

app.post('/generate', async (req, res) => {
  try {
    const requestedBillNo = String(req.body?.billNo || '').trim();
    const requestedDate = String(req.body?.date || '').trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!items.length || items.length > 100) {
      return res.status(400).json({
        error: 'Add between 1 and 100 particulars.'
      });
    }

    for (const item of items) {
      if (!String(item.particulars || '').trim() ||
          !String(item.qtyLabel || '').trim()) {
        return res.status(400).json({
          error: 'Enter particulars and quantity label for every row.'
        });
      }

      const qty = quantityFromLabel(item.qtyLabel);
      const rate = Number(item.rate);

      if (!Number.isFinite(qty) || qty < 0 ||
          !Number.isFinite(rate) || rate < 0) {
        return res.status(400).json({
          error: 'Invalid quantity label or rate.'
        });
      }
    }

    const advance = Number(req.body.advance || 0);

    if (!Number.isFinite(advance) || advance < 0) {
      return res.status(400).json({ error: 'Invalid advance amount.' });
    }

    let billNo = requestedBillNo;
    if (!billNo) {
      billNo = nextBillMeta().billNo;
    }

    let date = today();

    if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      const parsed = new Date(requestedDate + 'T00:00:00Z');

      if (!Number.isNaN(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === requestedDate) {
        date = requestedDate;
      }
    }

    const billData = {
      billNo,
      date,
      name: String(req.body.name || ''),
      address: String(req.body.address || ''),
      advance,
      items
    };

    const svg = Buffer.from(billSvg(billData));
    const png = await sharp(svg).png().toBuffer();

    res.set('X-Bill-No', billNo);
    res.set('X-Bill-Date', date);
    res.type('png').send(png);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Bill generation failed.' });
  }
});

app.listen(PORT, () => {
  console.log('Devidas bill generator running at http://localhost:' + PORT);
});
