const ALLERGENS = [
  ["えび", ["えび", "エビ", "海老"]],
  ["かに", ["かに", "カニ", "蟹"]],
  ["くるみ", ["くるみ", "クルミ"]],
  ["小麦", ["小麦", "こむぎ", "麦"]],
  ["そば", ["そば", "蕎麦"]],
  ["卵", ["卵", "たまご", "玉子", "鶏卵"]],
  ["乳", ["乳", "牛乳", "乳成分", "脱脂粉乳", "バター", "チーズ"]],
  ["落花生", ["落花生", "ピーナッツ", "ﾋﾟｰﾅｯﾂ"]],
  ["アーモンド", ["アーモンド"]],
  ["あわび", ["あわび", "アワビ"]],
  ["いか", ["いか", "イカ"]],
  ["いくら", ["いくら", "イクラ"]],
  ["オレンジ", ["オレンジ"]],
  ["カシューナッツ", ["カシューナッツ", "カシューナツ"]],
  ["キウイフルーツ", ["キウイ", "キウイフルーツ"]],
  ["牛肉", ["牛肉", "ビーフ"]],
  ["ごま", ["ごま", "ゴマ", "胡麻"]],
  ["さけ", ["さけ", "サケ", "鮭", "サーモン"]],
  ["さば", ["さば", "サバ", "鯖"]],
  ["大豆", ["大豆", "だいず", "豆乳", "しょうゆ", "醤油", "みそ", "味噌"]],
  ["鶏肉", ["鶏肉", "とり肉", "チキン"]],
  ["バナナ", ["バナナ"]],
  ["豚肉", ["豚肉", "ポーク"]],
  ["もも", ["もも", "モモ", "桃"]],
  ["やまいも", ["やまいも", "ヤマイモ", "山芋"]],
  ["りんご", ["りんご", "リンゴ", "林檎"]]
];
const SAMPLE = `日付,献立名,原材料
2026/09/14,カレーライス,小麦・牛肉・乳成分
2026/09/15,鮭の塩焼き,さけ・大豆
2026/09/16,豆腐ハンバーグ,大豆・小麦・鶏肉
2026/09/17,野菜スープ,たまねぎ・にんじん・キャベツ`;

let rows = [];
let headers = [];
let hasChecked = false;
let pdfPageImages = [];

const $ = (id) => document.getElementById(id);
const normalize = (value) => value.normalize("NFKC").toLowerCase();

function renderAllergens() {
  $("allergen-list").innerHTML = ALLERGENS.map(([name]) =>
    `<label class="allergen"><input type="checkbox" value="${name}" checked> <span>${name}</span></label>`
  ).join("");
}

function parseDelimited(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const parseLine = (line) => {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { cells.push(cell.trim()); cell = ""; }
      else cell += char;
    }
    cells.push(cell.trim());
    return cells;
  };
  const first = parseLine(lines[0]);
  const hasHeader = first.some((cell) => /日付|献立|料理|原材料|材料|メニュー/i.test(cell));
  const names = hasHeader ? first : first.map((_, index) => `項目${index + 1}`);
  const data = (hasHeader ? lines.slice(1) : lines).map(parseLine);
  return { headers: names, rows: data };
}

function matchingAllergens(row) {
  const selected = [...document.querySelectorAll("#allergen-list input:checked")].map((input) => input.value);
  const text = normalize(row.join(" "));
  return ALLERGENS.filter(([name, words]) => selected.includes(name) && words.some((word) => text.includes(normalize(word)))).map(([name]) => name);
}

function displayResults() {
  const body = $("result-body");
  const head = $("result-head");
  body.innerHTML = "";
  head.innerHTML = "";
  if (!rows.length) {
    $("result-summary").textContent = "献立を読み込むと結果が表示されます。";
    $("download-button").disabled = true;
    $("serving-button").disabled = true;
    $("serving-image-button").disabled = true;
    return;
  }
  const dateIndex = headers.findIndex((header) => /日付|日にち|日|date/i.test(header));
  const menuIndex = headers.findIndex((header) => /献立名|メニュー|料理名|献立|料理|menu/i.test(header));
  const displayDateIndex = dateIndex >= 0 ? dateIndex : 0;
  const displayMenuIndex = menuIndex >= 0 && menuIndex !== displayDateIndex ? menuIndex : (headers.length > 1 ? 1 : 0);
  head.innerHTML = "<tr><th>日にち</th><th>メニュー</th><th>判定</th></tr>";
  let matches = 0;
  let currentDate = null;
  rows.forEach((row) => {
    const date = formatDate(row[displayDateIndex] || "");
    if (date !== currentDate) {
      currentDate = date;
      body.insertAdjacentHTML("beforeend", `<tr class="date-group"><th colspan="3">${escapeHtml(date || "日付未記載")}</th></tr>`);
    }
    const allergens = matchingAllergens(row);
    if (allergens.length) matches += 1;
    const cells = `<td>${escapeHtml(formatDate(row[displayDateIndex] || ""))}</td><td>${escapeHtml(row[displayMenuIndex] || "")}</td>`;
    body.insertAdjacentHTML("beforeend", `<tr>${cells}<td class="${allergens.length ? "match" : "safe"}">${allergens.length ? `可能性あり（${allergens.join("・")}）` : "該当なし"}</td></tr>`);
  });
  $("result-summary").textContent = `${rows.length}件中 ${matches}件で、選択したアレルゲンの可能性が見つかりました。`;
  $("download-button").disabled = false;
  $("serving-button").disabled = false;
  $("serving-image-button").disabled = false;
  hasChecked = true;
}

function formatDate(value) {
  const match = String(value).match(/(\d{4})\s*[年\/.-]\s*(\d{1,2})\s*[月\/.-]\s*(\d{1,2})\s*日?/);
  if (!match) return String(value).trim();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return String(value).trim();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日（${weekdays[date.getDay()]}）`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function loadText(text, label = "") {
  const parsed = parseDelimited(text);
  if (!parsed.rows.length || !parsed.headers.length) {
    $("message").textContent = "読み込めるデータがありません。CSVまたはTSVの内容を確認してください。";
    $("message").hidden = false;
    return;
  }
  ({ headers, rows } = parsed);
  hasChecked = false;
  $("message").hidden = true;
  $("file-status").textContent = label ? `${label}を読み込みました` : "貼り付けたデータを読み込みました";
  $("check-button").disabled = false;
  $("result-summary").textContent = "チェック開始ボタンを押すと結果が表示されます。";
  $("result-head").innerHTML = "";
  $("result-body").innerHTML = "";
  $("download-button").disabled = true;
  $("serving-button").disabled = true;
  $("serving-image-button").disabled = true;
  $("serving-preview").hidden = true;
}

function downloadResults() {
  const output = [headers.concat("判定")];
  rows.forEach((row) => {
    const allergens = matchingAllergens(row);
    output.push(row.concat(allergens.length ? `可能性あり（${allergens.join("・")}）` : "該当なし"));
  });
  downloadCsv(output, "給食アレルギーチェック結果.csv");
}

function downloadServingTable() {
  const output = [headers.concat("盛り付け")];
  rows.forEach((row) => output.push(row.concat(matchingAllergens(row).length ? "✕" : "")));
  downloadCsv(output, "盛り付け表.csv");
}

function createServingImage() {
  if (pdfPageImages.length) {
    createPdfServingImage();
    return;
  }
  const scale = 2;
  const rowHeight = 42;
  const padding = 24;
  const columnWidths = headers.map((header, index) => Math.max(120, Math.min(280,
    Math.max(String(header).length, ...rows.map((row) => String(row[index] || "").length)) * 16 + 28)));
  const width = columnWidths.reduce((total, value) => total + value, 0) + 100 + padding * 2;
  const height = (rows.length + 1) * rowHeight + padding * 2 + 42;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.font = 'bold 18px "Noto Sans JP", "Yu Gothic", sans-serif';
  context.fillStyle = "#20302c";
  context.fillText("盛り付け表", padding, padding + 18);
  const tableTop = padding + 36;
  let x = padding;
  context.font = 'bold 14px "Noto Sans JP", "Yu Gothic", sans-serif';
  headers.concat("盛り付け").forEach((header, index) => {
    const cellWidth = index < columnWidths.length ? columnWidths[index] : 100;
    context.fillStyle = "#eaf4ef";
    context.fillRect(x, tableTop, cellWidth, rowHeight);
    context.strokeStyle = "#c9dcd4";
    context.strokeRect(x, tableTop, cellWidth, rowHeight);
    context.fillStyle = "#20302c";
    context.fillText(String(header), x + 10, tableTop + 26);
    x += cellWidth;
  });
  rows.forEach((row, rowIndex) => {
    x = padding;
    const y = tableTop + (rowIndex + 1) * rowHeight;
    const allergens = matchingAllergens(row);
    row.forEach((cell, index) => {
      context.fillStyle = "#ffffff";
      context.strokeStyle = "#dce6e2";
      context.fillRect(x, y, columnWidths[index], rowHeight);
      context.strokeRect(x, y, columnWidths[index], rowHeight);
      context.fillStyle = "#20302c";
      context.font = '14px "Noto Sans JP", "Yu Gothic", sans-serif';
      context.fillText(String(cell || "").slice(0, 24), x + 10, y + 26);
      x += columnWidths[index];
    });
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#dce6e2";
    context.fillRect(x, y, 100, rowHeight);
    context.strokeRect(x, y, 100, rowHeight);
    if (allergens.length) {
      context.fillStyle = "#aa3d3d";
      context.font = 'bold 25px sans-serif';
      context.fillText("✕", x + 36, y + 29);
    }
  });
  $("serving-image").src = canvas.toDataURL("image/png");
  $("serving-preview").hidden = false;
}

function createPdfServingImage() {
  const [{ canvas: pageCanvas, lines }] = pdfPageImages;
  const width = pageCanvas.width;
  const height = pageCanvas.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#dfe8e4";
  context.fillRect(0, 0, width, height);
  context.drawImage(pageCanvas, 0, 0);
  lines.forEach((line) => {
    if (!matchingAllergens(line.text.split("\t")).length) return;
    const rightEdge = Math.max(...line.items.map((item) => item.x + item.width));
    context.fillStyle = "#aa3d3d";
    context.font = 'bold 30px sans-serif';
    context.fillText("✕", Math.min(rightEdge + 12, pageCanvas.width - 38), line.canvasY + 10);
  });
  $("serving-image").src = canvas.toDataURL("image/png");
  $("serving-preview").hidden = false;
}

function downloadServingImage() {
  const image = $("serving-image");
  if (!image.src) return;
  const link = document.createElement("a");
  link.href = image.src;
  link.download = "盛り付け表.png";
  link.click();
}

function downloadCsv(output, filename) {
  const csv = output.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}

renderAllergens();
async function readFile(file) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  return utf8.includes("\uFFFD") ? new TextDecoder("shift-jis").decode(buffer) : utf8;
}

async function extractPdfText(file, saveImages = false) {
  if (!window.pdfjsLib) throw new Error("PDF読み込みライブラリを利用できません。");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdfDocument = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines = [];
  const pageImages = [];
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = viewport.width;
    pageCanvas.height = viewport.height;
    await page.render({ canvasContext: pageCanvas.getContext("2d"), viewport }).promise;
    const pageLines = [];
    const content = await page.getTextContent();
    content.items.filter((item) => item.str && item.transform).forEach((item) => {
      const x = item.transform[4] * 1.5;
      const y = item.transform[5] * 1.5;
      let line = pageLines.find((candidate) => Math.abs(candidate.y - y) < 3);
      if (!line) { line = { y, items: [] }; pageLines.push(line); }
      line.items.push({ x, width: (item.width || 0) * 1.5, text: item.str });
    });
    pageLines.sort((a, b) => b.y - a.y).forEach((line) => {
      line.items.sort((a, b) => a.x - b.x);
      let previousEnd = null;
      const cells = [];
      line.items.forEach((item) => {
        const gap = previousEnd === null ? 0 : item.x - previousEnd;
        if (gap > 18) cells.push(item.text.trim());
        else if (cells.length) cells[cells.length - 1] += item.text;
        else cells.push(item.text.trim());
        previousEnd = item.x + item.width;
      });
      if (cells.some((cell) => cell)) {
        lines.push(cells.join("\t"));
        line.text = cells.join("\t");
        line.canvasY = viewport.height - line.y;
      }
    });
    pageImages.push({ canvas: pageCanvas, lines: pageLines.filter((line) => line.text) });
  }
  if (!lines.length && !saveImages) throw new Error("PDFから文字を抽出できませんでした。画像PDFには対応していないため、文字情報を含むPDFを選択してください。");
  if (saveImages) pdfPageImages = pageImages;
  return lines.join("\n");
}

$("file-input").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) pdfPageImages = [];
    const text = isPdf ? await extractPdfText(file) : await readFile(file);
    loadText(text, file.name);
  } catch (error) {
    $("message").textContent = error.message || "ファイルを読み込めませんでした。";
    $("message").hidden = false;
    $("file-status").textContent = "";
  }
});
$("serving-file-input").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    await extractPdfText(file, true);
    $("serving-file-status").textContent = `${file.name}を読み込みました`;
    $("message").hidden = true;
  } catch (error) {
    $("message").textContent = error.message || "盛り付け表を読み込めませんでした。";
    $("message").hidden = false;
    $("serving-file-status").textContent = "";
  }
});
$("load-button").addEventListener("click", () => loadText($("data-input").value));
$("sample-button").addEventListener("click", () => { $("data-input").value = SAMPLE; loadText(SAMPLE, "サンプル"); });
$("check-button").addEventListener("click", displayResults);
$("serving-button").addEventListener("click", downloadServingTable);
$("serving-image-button").addEventListener("click", createServingImage);
$("download-image-button").addEventListener("click", downloadServingImage);
$("select-all").addEventListener("click", () => document.querySelectorAll("#allergen-list input").forEach((input) => { input.checked = true; }));
$("clear-all").addEventListener("click", () => document.querySelectorAll("#allergen-list input").forEach((input) => { input.checked = false; }));
$("allergen-list").addEventListener("change", () => { if (hasChecked) displayResults(); });
$("download-button").addEventListener("click", downloadResults);
