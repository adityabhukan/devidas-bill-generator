const express = require("express");
const sharp = require("sharp");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

// -------------------- HELPERS --------------------

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  }[char]));
}

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function todayIndia() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const date = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${date.year}-${date.month}-${date.day}`;
}

function formatDate(dateString) {
  if (!dateString) return "";

  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;

  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function quantityFromLabel(label) {
  const match = String(label || "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)/);

  return match ? Number(match[1]) : 1;
}

// -------------------- BILL IMAGE --------------------

function createBillSvg(data) {
  const items = data.items.map((item) => {
    const qtyLabel = String(item.qtyLabel || "").trim();
    const qty = quantityFromLabel(qtyLabel);
    const rate = Number(item.rate || 0);

    return {
      particulars: escapeHtml(item.particulars),
      qtyLabel: escapeHtml(qtyLabel),
      rate,
      amount: qty * rate
    };
  });

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const advance = Number(data.advance || 0);
  const balance = total - advance;

  const billNo = escapeHtml(data.billNo);
  const name = escapeHtml(data.name);
  const address = escapeHtml(data.address);

  const fromDate = escapeHtml(formatDate(data.fromDate));
  const toDate = escapeHtml(formatDate(data.toDate));

  const firstRowY = 530;
  const rowHeight = 34;

  // Extra space is added automatically for more bill items.
  const tableBottom = Math.max(
    900,
    firstRowY + items.length * rowHeight + 150
  );

  const footerY = tableBottom + 40;
  const svgHeight = Math.max(1123, footerY + 150);

  const itemRows = items.map((item, index) => {
    const y = firstRowY + index * rowHeight;

    return `
      <text x="74" y="${y}" text-anchor="middle" font-size="14">
        ${index + 1}
      </text>

      <text x="130" y="${y}" font-size="14">
        ${item.particulars}
      </text>

      <text x="487" y="${y}" text-anchor="middle" font-size="14">
        ${item.qtyLabel}
      </text>

      <text x="572" y="${y}" text-anchor="middle" font-size="14">
        ${money(item.rate)}
      </text>

      <text x="705" y="${y}" text-anchor="middle" font-size="14">
        ${money(item.amount)}
      </text>
    `;
  }).join("");

  const advanceY = tableBottom - 115;
  const balanceY = tableBottom - 70;
  const totalY = tableBottom - 25;

  return `<?xml version="1.0" encoding="UTF-8"?>

<svg xmlns="http://www.w3.org/2000/svg"
     width="794"
     height="${svgHeight}"
     viewBox="0 0 794 ${svgHeight}">

  <rect width="794" height="${svgHeight}" fill="white"/>

  <g font-family="Arial, Helvetica, sans-serif" fill="#111">

    <!-- Company Header -->

    <text x="430" y="126"
          text-anchor="middle"
          font-family="Georgia,serif"
          font-size="31">
      DEVIDAS HEALTHCARE SERVICES
    </text>

    <text x="690" y="52"
          text-anchor="middle"
          font-size="14">
      Mobile: 9224471242
    </text>

    <text x="690" y="84"
          text-anchor="middle"
          font-size="14">
      9821548685
    </text>

    <text x="430" y="157"
          text-anchor="middle"
          font-size="14">
      Reg.No.: E-11725/Thane
    </text>

    <text x="430" y="181"
          text-anchor="middle"
          font-size="14">
      Male &amp; Female Attendant, Qualified Nurses, Baby Care
    </text>

    <text x="430" y="204"
          text-anchor="middle"
          font-size="14">
      WE CARE TAKERS FOR PATIENT HOSPITAL &amp; HOME PROVIDER
    </text>

    <line x1="0" y1="224"
          x2="794" y2="224"
          stroke="#555"/>

    <text x="96" y="240" font-size="14">
      Add:- A-Wing 206, Satyam Prestige CHS, Plot No. 14 Sector 4,
      Karnjade, Panvel-410206
    </text>

    <text x="96" y="263" font-size="14">
      Email: devidaspandirkar786@gmail.com
    </text>

    <!-- Customer Details Box -->

    <rect x="35" y="279"
          width="724"
          height="165"
          rx="25"
          fill="none"
          stroke="#111"
          stroke-width="1.5"/>

    <!-- Bill Number -->

    <text x="60" y="322" font-size="14">
      Bill No. :-
    </text>

    <text x="130" y="322" font-size="14">
      ${billNo}
    </text>

    <line x1="126" y1="327"
          x2="350" y2="327"
          stroke="#444"/>

    <!-- From Date -->

    <text x="60" y="365" font-size="14">
      From:
    </text>

    <text x="130" y="365" font-size="14">
      ${fromDate}
    </text>

    <line x1="126" y1="370"
          x2="350" y2="370"
          stroke="#444"/>

    <!-- To Date -->

    <text x="410" y="365" font-size="14">
      To:
    </text>

    <text x="450" y="365" font-size="14">
      ${toDate}
    </text>

    <line x1="446" y1="370"
          x2="735" y2="370"
          stroke="#444"/>

    <!-- Customer Name -->

    <text x="60" y="405" font-size="14">
      Name :-
    </text>

    <text x="130" y="405" font-size="14">
      ${name}
    </text>

    <line x1="126" y1="410"
          x2="735" y2="410"
          stroke="#444"/>

    <!-- Customer Address -->

    <text x="60" y="433" font-size="14">
      Add :-
    </text>

    <text x="130" y="433" font-size="14">
      ${address}
    </text>

    <!-- Particulars Table -->

    <rect x="32" y="460"
          width="764"
          height="${tableBottom - 460}"
          fill="none"
          stroke="#111"/>

    <line x1="115" y1="460"
          x2="115" y2="${tableBottom}"
          stroke="#111"/>

    <line x1="445" y1="460"
          x2="445" y2="${tableBottom}"
          stroke="#111"/>

    <line x1="530" y1="460"
          x2="530" y2="${tableBottom}"
          stroke="#111"/>

    <line x1="615" y1="460"
          x2="615" y2="${tableBottom}"
          stroke="#111"/>

    <line x1="32" y1="500"
          x2="796" y2="500"
          stroke="#111"/>

    <!-- Table Heading -->

    <text x="74" y="477"
          text-anchor="middle"
          font-size="14">
      Sr.
    </text>

    <text x="74" y="494"
          text-anchor="middle"
          font-size="14">
      No.
    </text>

    <text x="280" y="486"
          text-anchor="middle"
          font-size="14">
      PARTICULARS
    </text>

    <text x="487" y="486"
          text-anchor="middle"
          font-size="14">
      Qty.
    </text>

    <text x="572" y="486"
          text-anchor="middle"
          font-size="14">
      Rate
    </text>

    <text x="705" y="477"
          text-anchor="middle"
          font-size="14">
      Amount
    </text>

    <text x="705" y="494"
          text-anchor="middle"
          font-size="14">
      RS. P.
    </text>

    <!-- Bill Items -->

    ${itemRows}

    <!-- Total / Advance / Balance -->

    <line x1="530" y1="${advanceY - 28}"
          x2="796" y2="${advanceY - 28}"
          stroke="#111"/>

    <line x1="530" y1="${balanceY - 28}"
          x2="796" y2="${balanceY - 28}"
          stroke="#111"/>

    <line x1="530" y1="${totalY - 28}"
          x2="796" y2="${totalY - 28}"
          stroke="#111"/>

    <text x="548" y="${advanceY}" font-size="14">
      Adv.
    </text>

    <text x="704" y="${advanceY}"
          text-anchor="middle"
          font-size="14">
      ${money(advance)}
    </text>

    <text x="548" y="${balanceY}" font-size="14">
      Bal.
    </text>

    <text x="704" y="${balanceY}"
          text-anchor="middle"
          font-size="14">
      ${money(balance)}
    </text>

    <text x="548" y="${totalY}" font-size="14">
      Total
    </text>

    <text x="704" y="${totalY}"
          text-anchor="middle"
          font-size="14">
      ${money(total)}
    </text>

    <!-- Signature Section -->

    <text x="774" y="${footerY}"
          text-anchor="end"
          font-size="14">
      For DEVIDAS HEALTHCARE SERVICES
    </text>

    <text x="48" y="${footerY + 72}"
          font-size="14">
      Receiver Signature
    </text>

    <text x="646" y="${footerY + 100}"
          text-anchor="middle"
          font-size="14">
      Proprietor
    </text>

  </g>
</svg>`;
}

// -------------------- WEBSITE FORM --------------------

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>Devidas Healthcare Bill Generator</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 20px;
  background: #f2f4f7;
  font-family: Arial, sans-serif;
  color: #1d2430;
}

.container {
  max-width: 900px;
  margin: auto;
}

.panel {
  background: white;
  padding: 22px;
  border-radius: 14px;
  box-shadow: 0 4px 20px #15223812;
}

h1 {
  font-size: 23px;
  margin-top: 0;
}

p {
  color: #667085;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

label {
  display: block;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 6px;
}

input {
  width: 100%;
  min-width: 0;
  padding: 11px;
  border: 1px solid #cfd5df;
  border-radius: 8px;
  font: inherit;
}

.full {
  grid-column: 1 / -1;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}

button {
  border: 0;
  border-radius: 8px;
  padding: 12px 16px;
  font-weight: bold;
  cursor: pointer;
  background: #135dcc;
  color: white;
}

.secondary {
  background: #e9eef7;
  color: #1d2430;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

#preview {
  display: none;
  width: 100%;
  margin-top: 20px;
  border: 1px solid #d8dee8;
}

.item-row {
  display: grid;
  grid-template-columns:
    minmax(150px, 2fr)
    minmax(110px, 1fr)
    minmax(110px, 1fr)
    auto;
  gap: 8px;
  margin-bottom: 12px;
  align-items: end;
}

.item-row button {
  padding: 10px;
}

@media(max-width:650px) {
  body {
    padding: 10px;
  }

  .panel {
    padding: 15px;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .full {
    grid-column: auto;
  }

  .item-row {
    grid-template-columns: 1fr 1fr;
  }

  .item-row > div:first-child {
    grid-column: 1 / -1;
  }

  .item-row .remove-item {
    grid-column: 1 / -1;
  }
}
</style>
</head>

<body>

<div class="container">
<div class="panel">

<h1>DEVIDAS HEALTHCARE SERVICES</h1>

<p>Create a bill with a service date range.</p>

<form id="billForm">

<div class="grid">

<div>
  <label for="billNo">Bill Number</label>
  <input id="billNo"
         name="billNo"
         placeholder="Enter bill number">
</div>

<div>
  <label for="fromDate">From Date</label>
  <input id="fromDate"
         name="fromDate"
         type="date"
         required>
</div>

<div>
  <label for="toDate">To Date</label>
  <input id="toDate"
         name="toDate"
         type="date"
         required>
</div>

<div>
  <label for="customerName">Customer / Patient Name</label>
  <input id="customerName"
         name="name"
         placeholder="Enter name"
         required>
</div>

<div class="full">
  <label for="customerAddress">Address</label>
  <input id="customerAddress"
         name="address"
         placeholder="Enter address"
         required>
</div>

<div class="full">
  <label>Particulars / Services</label>

  <div id="items"></div>

  <button type="button"
          class="secondary"
          id="addItem">
    + Add Particular
  </button>
</div>

<div>
  <label for="advance">Advance Paid (₹)</label>
  <input id="advance"
         name="advance"
         type="number"
         min="0"
         step="0.01"
         value="0"
         required>
</div>

</div>

<div class="actions">

<button type="submit" id="generate">
  Generate Bill Image
</button>

<button type="button"
        class="secondary"
        id="download"
        disabled>
  Download PNG
</button>

<button type="button"
        class="secondary"
        id="share"
        disabled>
  Share to WhatsApp
</button>

</div>

<p>
On Android, tap Share to open the sharing menu.
Choose WhatsApp, select the customer chat, and press Send.
</p>

</form>

<img id="preview" alt="Generated bill preview">

</div>
</div>

<script>
const form = document.getElementById("billForm");
const itemsContainer = document.getElementById("items");
const preview = document.getElementById("preview");

const downloadButton = document.getElementById("download");
const shareButton = document.getElementById("share");
const generateButton = document.getElementById("generate");

let billBlob = null;
let previewUrl = null;

// Today's date in India.
function indiaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const date = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return date.year + "-" + date.month + "-" + date.day;
}

document.getElementById("fromDate").value = indiaToday();
document.getElementById("toDate").value = indiaToday();

// Create a service row.
function addItemRow(
  particulars = "",
  qtyLabel = "",
  rate = "0"
) {
  const row = document.createElement("div");
  row.className = "item-row";

  const fields = [
    ["Particulars", "item-particulars", particulars, "Service name"],
    ["Qty. Label", "item-qty-label", qtyLabel, "e.g. 30 DAYS"],
    ["Rate (₹)", "item-rate", rate, ""]
  ];

  for (const [labelText, className, value, placeholder] of fields) {
    const wrapper = document.createElement("div");

    const label = document.createElement("label");
    label.textContent = labelText;

    const input = document.createElement("input");
    input.className = className;
    input.value = value;
    input.placeholder = placeholder;

    if (className === "item-rate") {
      input.type = "number";
      input.min = "0";
      input.step = "0.01";
      input.required = true;
    } else {
      input.type = "text";
      input.required = true;
    }

    wrapper.append(label, input);
    row.appendChild(wrapper);
  }

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary remove-item";
  removeButton.textContent = "Remove";

  removeButton.addEventListener("click", () => {
    if (itemsContainer.children.length > 1) {
      row.remove();
    } else {
      alert("At least one particular is required.");
    }
  });

  row.appendChild(removeButton);
  itemsContainer.appendChild(row);
}

// Default service row.
addItemRow("Male Attendant", "30 DAYS", "700");

// Add another service.
document.getElementById("addItem").addEventListener("click", () => {
  addItemRow();
});

// Generate bill image.
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fromDate = document.getElementById("fromDate").value;
  const toDate = document.getElementById("toDate").value;

  if (fromDate > toDate) {
    alert("From Date cannot be after To Date.");
    return;
  }

  generateButton.disabled = true;
  generateButton.textContent = "Generating...";

  try {
    const data = {
      billNo: document.getElementById("billNo").value,
      fromDate,
      toDate,
      name: document.getElementById("customerName").value,
      address: document.getElementById("customerAddress").value,
      advance: document.getElementById("advance").value,

      items: Array.from(
        itemsContainer.querySelectorAll(".item-row")
      ).map(row => ({
        particulars: row.querySelector(".item-particulars").value,
        qtyLabel: row.querySelector(".item-qty-label").value,
        rate: row.querySelector(".item-rate").value
      }))
    };

    const response = await fetch("/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      alert(error.error || "Bill generation failed.");
      return;
    }

    billBlob = await response.blob();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    previewUrl = URL.createObjectURL(billBlob);

    preview.src = previewUrl;
    preview.style.display = "block";

    downloadButton.disabled = false;
    shareButton.disabled = false;

  } catch (error) {
    console.error(error);
    alert("Could not connect to the server.");
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "Generate Bill Image";
  }
});

// Download bill as PNG.
downloadButton.addEventListener("click", () => {
  if (!billBlob) return;

  const url = URL.createObjectURL(billBlob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "devidas-bill.png";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// Share bill image using Android's share menu.
shareButton.addEventListener("click", async () => {
  if (!billBlob) return;

  const file = new File(
    [billBlob],
    "devidas-bill.png",
    { type: "image/png" }
  );

  if (
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: "Devidas Healthcare Bill"
      });
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(error);
      }
    }
  } else {
    alert(
      "Image sharing is not supported here. " +
      "Download the PNG and attach it in WhatsApp."
    );
  }
});
</script>

</body>
</html>`);
});

// -------------------- GENERATE PNG --------------------

app.post("/generate", async (req, res) => {
  try {
    const data = req.body || {};

    const fromDate = String(data.fromDate || "").trim();
    const toDate = String(data.toDate || "").trim();

    const items = Array.isArray(data.items) ? data.items : [];

    if (!fromDate || !toDate) {
      return res.status(400).json({
        error: "Please select both From Date and To Date."
      });
    }

    if (fromDate > toDate) {
      return res.status(400).json({
        error: "From Date cannot be after To Date."
      });
    }

    if (!items.length || items.length > 100) {
      return res.status(400).json({
        error: "Add between 1 and 100 particulars."
      });
    }

    for (const item of items) {
      if (
        !String(item.particulars || "").trim() ||
        !String(item.qtyLabel || "").trim()
      ) {
        return res.status(400).json({
          error: "Enter particulars and quantity for every row."
        });
      }

      const qty = quantityFromLabel(item.qtyLabel);
      const rate = Number(item.rate);

      if (
        !Number.isFinite(qty) ||
        qty < 0 ||
        !Number.isFinite(rate) ||
        rate < 0
      ) {
        return res.status(400).json({
          error: "Invalid quantity or rate."
        });
      }
    }

    const advance = Number(data.advance || 0);

    if (!Number.isFinite(advance) || advance < 0) {
      return res.status(400).json({
        error: "Invalid advance amount."
      });
    }

    // Simple automatic bill number.
    const billNo = String(data.billNo || "").trim() ||
      `DHS-${Date.now()}`;

    const billData = {
      billNo,
      fromDate,
      toDate,
      name: String(data.name || ""),
      address: String(data.address || ""),
      advance,
      items
    };

    const svg = Buffer.from(createBillSvg(billData));

    const png = await sharp(svg)
      .png()
      .toBuffer();

    res.set("X-Bill-No", billNo);
    res.type("png").send(png);

  } catch (error) {
    console.error("Bill generation error:", error);

    res.status(500).json({
      error: "Bill generation failed."
    });
  }
});

// -------------------- START SERVER --------------------

app.listen(PORT, () => {
  console.log(`Devidas bill generator running on port ${PORT}`);
});
