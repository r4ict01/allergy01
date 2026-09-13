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
    return;
  }
  head.innerHTML = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}<th>判定</th></tr>`;
  let matches = 0;
  rows.forEach((row) => {
    const allergens = matchingAllergens(row);
    if (allergens.length) matches += 1;
    const cells = headers.map((_, i) => `<td>${escapeHtml(row[i] || "")}</td>`).join("");
    body.insertAdjacentHTML("beforeend", `<tr>${cells}<td class="${allergens.length ? "match" : "safe"}">${allergens.length ? `可能性あり（${allergens.join("・")}）` : "該当なし"}</td></tr>`);
  });
  $("result-summary").textContent = `${rows.length}件中 ${matches}件で、選択したアレルゲンの可能性が見つかりました。`;
  $("download-button").disabled = false;
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
  $("message").hidden = true;
  $("file-status").textContent = label ? `${label}を読み込みました` : "貼り付けたデータを読み込みました";
  displayResults();
}

function downloadResults() {
  const output = [headers.concat("判定")];
  rows.forEach((row) => output.push(row.concat(matchingAllergens(row).length ? `可能性あり（${matchingAllergens(row).join("・")}）` : "該当なし")));
  const csv = output.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "給食アレルギーチェック結果.csv"; link.click();
  URL.revokeObjectURL(url);
}

renderAllergens();
async function readFile(file) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  return utf8.includes("\uFFFD") ? new TextDecoder("shift-jis").decode(buffer) : utf8;
}

async function extractPdfText(file) {
  if (!window.pdfjsLib) throw new Error("PDF読み込みライブラリを利用できません。");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageLines = [];
    content.items.filter((item) => item.str && item.transform).forEach((item) => {
      const x = item.transform[4];
      const y = item.transform[5];
      let line = pageLines.find((candidate) => Math.abs(candidate.y - y) < 3);
      if (!line) { line = { y, items: [] }; pageLines.push(line); }
      line.items.push({ x, width: item.width || 0, text: item.str });
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
      if (cells.some((cell) => cell)) lines.push(cells.join("\t"));
    });
  }
  if (!lines.length) throw new Error("PDFから文字を抽出できませんでした。画像PDFには対応していないため、文字情報を含むPDFを選択してください。");
  return lines.join("\n");
}

$("file-input").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      ? await extractPdfText(file)
      : await readFile(file);
    loadText(text, file.name);
  } catch (error) {
    $("message").textContent = error.message || "ファイルを読み込めませんでした。";
    $("message").hidden = false;
    $("file-status").textContent = "";
  }
});
$("load-button").addEventListener("click", () => loadText($("data-input").value));
$("sample-button").addEventListener("click", () => { $("data-input").value = SAMPLE; loadText(SAMPLE, "サンプル"); });
$("select-all").addEventListener("click", () => document.querySelectorAll("#allergen-list input").forEach((input) => { input.checked = true; }));
$("clear-all").addEventListener("click", () => document.querySelectorAll("#allergen-list input").forEach((input) => { input.checked = false; }));
$("allergen-list").addEventListener("change", displayResults);
$("download-button").addEventListener("click", downloadResults);
