#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Codemod i18n: bungkus teks paparan Bahasa Melayu dengan t("…") (lib/i18n.ts).
 *
 *   node scripts/i18n-codemod.cjs [--dry] [fail...]     (lalai: semua fail src/ kecuali yang dikecualikan)
 *   node scripts/i18n-codemod.cjs --keys                 senaraikan semua kunci t("…") ke stdout (JSON)
 *
 * Dalam mod Bahasa Melayu t(x) memulangkan x tanpa perubahan, jadi kelakuan BM kekal sama.
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..", "src");
const KECUALI = [/components[\\/]PilihBahasa\.tsx$/, /lib[\\/]i18n\.ts$/, /lib[\\/]kamus[\\/]/, /database\.types\.ts$/];

const ATTR_KOD = new Set([
  "className", "href", "type", "id", "key", "role", "name", "inputMode", "autoComplete", "accept", "capture", "src", "rel", "target",
  "method", "value", "defaultValue", "tone", "lebar", "mode", "d", "viewBox", "fill", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin",
  "width", "height", "x", "y", "cx", "cy", "r", "points", "style", "ikon", "kind", "back", "backHr", "min", "max", "step", "pattern", "lang",
  "htmlFor", "form", "dir", "size", "colSpan", "scope", "rows", "cols", "aria-sort", "aria-checked", "aria-current", "aria-expanded", "aria-hidden",
  "aria-live", "aria-modal", "enterKeyHint", "encType", "download", "sizes", "media", "as", "crossOrigin", "integrity", "nonce", "slot", "tabIndex",
  "maxLength", "minLength", "fetchPriority", "loading", "decoding", "referrerPolicy", "wrap", "spellCheck", "translate", "hidden", "open",
  "status", "fontFamily", "textAnchor", "dominantBaseline", "transform", "x1", "x2", "y1", "y2", "rx", "ry", "offset", "stopColor", "gradientUnits",
]);
const KUNCI_KOD = new Set([
  "href", "className", "type", "kind", "k", "id", "key", "code", "tone", "ikon", "lebar", "mode", "status", "value", "path", "field", "op", "role",
  "roles", "icon", "cls", "warna", "kotak", "ref", "alias", "jenis_kod", "contentType", "onConflict", "p_via", "p_kind", "p_action", "p_type",
  "p_decision", "p_recommendation", "p_day_type", "p_kind", "level", "lv", "nada", "fn", "kunci", "backHr", "back", "redirectTo", "emailRedirectTo",
  "channel", "event", "schema", "table", "filter", "headers", "method", "cache", "credentials", "body", "mimeType", "format", "locale", "timeZone",
  "weekday", "month", "day", "year", "hour", "minute", "hour12", "style", "currency", "minimumFractionDigits", "maximumFractionDigits",
]);
const KAEDAH_KOD = new Set([
  "rpc", "from", "select", "eq", "neq", "in", "order", "is", "like", "ilike", "gte", "lte", "gt", "lt", "match", "contains", "filter", "or", "not",
  "maybeSingle", "single", "upload", "download", "getItem", "setItem", "removeItem", "addEventListener", "removeEventListener", "querySelector",
  "querySelectorAll", "createElement", "getAttribute", "setAttribute", "startsWith", "endsWith", "includes", "split", "replace", "replaceAll", "join",
  "padStart", "padEnd", "toLocaleString", "toLocaleDateString", "toLocaleTimeString", "invoke", "push", "replace", "test", "localeCompare",
  "createSignedUrl", "remove", "list", "storage", "channel", "on", "limit", "range", "csv", "update", "insert", "upsert", "delete", "get", "has",
  "set", "indexOf", "lastIndexOf", "search", "concat", "slice", "matchAll", "prefetch", "getElementById", "closest", "matches", "toggle", "add",
  "keys", "emit", "postMessage", "readSheet", "subscribe", "signInWithOtp", "verifyOtp", "signInWithPassword", "updateUser", "auth",
]);
const FUNGSI_KOD = new Set([
  "t", "tr", "useSimpanan", "Event", "Blob", "URLSearchParams", "fetch", "encodeURIComponent", "decodeURIComponent", "Number", "Date", "RegExp", "Intl",
  "require", "import", "useState", "useRef", "parseInt", "parseFloat", "Symbol", "BigInt", "atob", "btoa", "Error_KOD", "matchMedia", "CustomEvent",
  "File", "Image", "Worker", "URL", "setTimeout", "clearTimeout", "console", "getSupabase", "panggilAi", "muatNaikPeribadi", "urlSementara",
  "new_Event", "cn", "clsx", "notFound", "redirect", "useSearchParams", "lamanUtama", "hasRole", "Response", "Request", "TextEncoder",
]);
const SETTER_TEKS = /^set(Ralat|Ok|Mesej|Pesan|Notis|Error|Info|Amaran|Berjaya|Teks|Label)/;

const TW_AWALAN = "px-|py-|p-\\d|pt-|pb-|pl-|pr-|m-\\d|mx-|my-|mt-|mb-|ml-|mr-|text-|bg-|rounded-|h-|w-|gap-|items-|justify-|border-|font-|min-|max-|z-|top-|bottom-|left-|right-|overflow-|whitespace-|tracking-|leading-|opacity-|shadow-|ring-|cursor-|line-clamp-|size-|accent-|print:|lg:|sm:|md:|hover:|focus:|disabled:|self-|place-|col-|row-|order-|basis-|aspect-|object-|snap-|scroll-|list-|space-|divide-|animate-|duration-|ease-|fill-|stroke-|decoration-|break-|content-|inset-|translate-|rotate-|scale-|origin-|pointer-|select-|empty:|first:|last:|odd:|even:|\\[&";
const TW_PERKATAAN = "flex|grid|block|inline|hidden|absolute|relative|sticky|fixed|rounded|border|shrink|grow|truncate|transition|tabular-nums|uppercase|outline|underline|italic|not-italic|sr-only|resize|appearance-none|shadow|ring";
const TAILWIND = new RegExp("(^|\\s|:)((" + TW_AWALAN + ")|((" + TW_PERKATAAN + ")(?=$|[\\s:/\\-\\[])))");

function manusia(s) {
  const x = s.trim();
  if (!x || !/[A-Za-zÀ-ÿ]/.test(x)) return false;
  if (/^(https?:|mailto:|tel:|\/|#|\.\/|data:|blob:)/.test(x)) return false;
  if (TAILWIND.test(" " + x)) return false;
  if (/^[\w.\-:/*+;=,!()]+$/.test(x) && !/\s/.test(x)) {
    // satu token: hanya perkataan berhuruf besar pertama + huruf kecil (cth. "Simpan", "Cuti")
    return /^[A-ZÀ-Ý][a-zà-ÿ][A-Za-zÀ-ÿ'’\-]*[.!?…:]?$/.test(x);
  }
  // senarai lajur / kod pangkalan data
  if (!/[A-Z]/.test(x) && /[_!(]/.test(x) && /,/.test(x)) return false;
  if (/^[a-z_]+(\.[a-z_]+)+$/.test(x)) return false;
  if (/^[a-z][a-z0-9_]*( [a-z][a-z0-9_]*)*$/.test(x) && /_/.test(x)) return false;
  return true;
}

function namaPanggilan(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return { nama: e.text, kaedah: null };
  if (ts.isPropertyAccessExpression(e)) return { nama: null, kaedah: e.name.text };
  return { nama: null, kaedah: null };
}

function dalamAtributKod(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) {
      const n = p.name.getText();
      return ATTR_KOD.has(n) || n.startsWith("data-") || n.startsWith("on");
    }
    if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

/** Konteks yang tidak boleh diterjemah (kod, kunci, perbandingan …). */
function konteksKod(node) {
  const p = node.parent;
  if (!p) return true;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isLiteralTypeNode(p)) return true;
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  if (ts.isPropertyAssignment(p) && p.initializer === node) {
    const k = p.name.getText().replace(/["']/g, "");
    if (KUNCI_KOD.has(k)) return true;
  }
  if (ts.isComputedPropertyName(p) || ts.isElementAccessExpression(p)) return true;
  if (ts.isBinaryExpression(p) && ["===", "!==", "==", "!=", "in", "instanceof"].includes(p.operatorToken.getText())) return true;
  if (ts.isCaseClause(p)) return true;
  if (ts.isEnumMember(p)) return true;
  if (ts.isTaggedTemplateExpression(p)) return true;
  if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
    const { nama, kaedah } = namaPanggilan(p);
    if (nama && FUNGSI_KOD.has(nama)) return true;
    if (kaedah && KAEDAH_KOD.has(kaedah)) return true;
    if (nama && /^set[A-Z]/.test(nama) && !SETTER_TEKS.test(nama)) return true;
    if (ts.isNewExpression(p) && nama && nama !== "Error" && nama !== "RalatAi") return true;
  }
  // tatasusunan "as const" & penjana jenis = pengecam, bukan teks
  const pasanganLabel =
    ts.isArrayLiteralExpression(p) && p.elements.length === 2 && p.elements[1] === node && ts.isStringLiteralLike(p.elements[0]) && /^[a-z0-9_]+$/.test(p.elements[0].text);
  for (let q = p; q && !ts.isSourceFile(q); q = q.parent) {
    if (ts.isAsExpression(q) && q.type.getText() === "const" && !pasanganLabel) return true;
    if (ts.isTypeNode(q)) return true;
    if (ts.isStatement(q) || ts.isFunctionLike(q)) break;
  }
  if (dalamAtributKod(node)) return true;
  return false;
}

function mengandungJsx(n) {
  let ada = false;
  (function c(x) {
    if (ada) return;
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) {
      ada = true;
      return;
    }
    ts.forEachChild(x, c);
  })(n);
  return ada;
}

/** Normalkan teks JSX mengikut peraturan ruang putih React. */
function normalJsx(raw) {
  const baris = raw.split(/\r?\n/);
  return baris
    .map((b, i) => {
      let x = b.replace(/\t/g, " ");
      if (i !== 0) x = x.replace(/^\s+/, "");
      if (i !== baris.length - 1) x = x.replace(/\s+$/, "");
      return x;
    })
    .filter((x) => x.length)
    .join(" ");
}
function entiti(s) {
  return s.replace(/&nbsp;/g, "\u00a0").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&rsquo;/g, "’").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function esc(s) {
  return JSON.stringify(s);
}

function proses(fail, kering) {
  const src = fs.readFileSync(fail, "utf8");
  const sf = ts.createSourceFile(fail, src, ts.ScriptTarget.Latest, true, fail.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const sunting = []; // { s, e, bina(render) }

  /** Satu larian anak JSX (teks + {ungkapan}) → satu ayat tr("… {0} …", ungkapan). */
  function gabung(larian) {
    const ungkapan = larian.filter((c) => ts.isJsxExpression(c) && !(ts.isStringLiteral(c.expression) || ts.isNoSubstitutionTemplateLiteral(c.expression)));
    const teksAda = larian.some((c) => ts.isJsxText(c) && /[A-Za-zÀ-ÿ]/.test(c.getFullText()));
    if (!teksAda || !ungkapan.length) {
      larian.forEach(lawat);
      return;
    }
    let ayat = "";
    let k = 0;
    const exprs = [];
    for (const c of larian) {
      if (ts.isJsxText(c)) ayat += entiti(normalJsx(c.getFullText()));
      else if (ts.isStringLiteral(c.expression) || ts.isNoSubstitutionTemplateLiteral(c.expression)) ayat += c.expression.text;
      else {
        ayat += `{${k++}}`;
        exprs.push(c.expression);
      }
    }
    const teks = ayat.replace(/\s+/g, " ").trim();
    const tanpa = teks.replace(/\{\d+\}/g, " ").trim();
    if (!/[A-Za-zÀ-ÿ]{2,}/.test(tanpa) || TAILWIND.test(" " + tanpa) || /[<>]/.test(teks)) {
      larian.forEach(lawat);
      return;
    }
    exprs.forEach(lawat);
    const depan = /^\s/.test(ayat) && !/^\s*\n/.test(larian[0].getFullText()) ? '{" "}' : "";
    const akhir = larian[larian.length - 1];
    const belakang = /\s$/.test(ayat) && !(ts.isJsxText(akhir) && /\n\s*$/.test(akhir.getFullText())) ? '{" "}' : "";
    sunting.push({
      s: larian[0].getStart(),
      e: akhir.getEnd(),
      bina: (render) => `${depan}{tr(${esc(teks)}${exprs.map((x) => ", " + render(x.getStart(), x.getEnd())).join("")})}${belakang}`,
    });
  }

  function lawat(node) {
    // jangan sentuh apa-apa yang sudah di dalam tr(...); jangan sentuh arahan "use client"
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "tr") return;
    if (ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression)) return;

    // Gabung teks JSX + ungkapan dalam satu ayat: "Lihat semua {0} permohonan"
    if ((ts.isJsxElement(node) || ts.isJsxFragment(node)) && node.children.length) {
      const anak = [...node.children];
      let i = 0;
      while (i < anak.length) {
        const larian = [];
        while (i < anak.length && (ts.isJsxText(anak[i]) || (ts.isJsxExpression(anak[i]) && anak[i].expression && !mengandungJsx(anak[i].expression)))) {
          larian.push(anak[i]);
          i++;
        }
        if (larian.length) gabung(larian);
        else {
          lawat(anak[i]);
          i++;
        }
      }
      if (ts.isJsxElement(node)) {
        lawat(node.openingElement);
      }
      return;
    }

    if (ts.isJsxText(node)) {
      const raw = node.getFullText();
      if (/[A-Za-zÀ-ÿ]/.test(raw)) {
        const baris = raw.split(/\r?\n/);
        const bersih = baris
          .map((b, i) => {
            let x = b.replace(/\t/g, " ");
            if (i !== 0) x = x.replace(/^\s+/, "");
            if (i !== baris.length - 1) x = x.replace(/\s+$/, "");
            return x;
          })
          .filter((x) => x.length)
          .join(" ");
        const teks = bersih.trim();
        if (teks && manusia(teks) && !/[{}<>]/.test(teks)) {
          const depan = /^ /.test(bersih) ? '{" "}' : "";
          const belakang = / $/.test(bersih) ? '{" "}' : "";
          const kunci = teks.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&rsquo;/g, "’").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
          sunting.push({ s: node.getStart(), e: node.getEnd(), bina: () => `${depan}{tr(${esc(kunci)})}${belakang}` });
          return;
        }
      }
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const v = node.text;
      const labelBesar =
        ts.isJsxAttribute(node.parent) && ["label", "tajuk", "title", "aria-label", "k"].includes(node.parent.name.getText()) && /^[A-ZÀ-Ý]{3,}$/.test(v) && !["KWSP", "PCB", "SIP", "HRDF", "LHDN", "SSM", "CEO", "EPF", "MTB", "DEMO"].includes(v);
      if ((manusia(v) || labelBesar) && !konteksKod(node)) {
        const dalamJsxAttr = ts.isJsxAttribute(node.parent);
        sunting.push({ s: node.getStart(), e: node.getEnd(), bina: () => (dalamJsxAttr ? `{tr(${esc(v)})}` : `tr(${esc(v)})`) });
      }
      return;
    }

    if (ts.isTemplateExpression(node) && !konteksKod(node)) {
      let teks = node.head.text;
      node.templateSpans.forEach((sp, i) => {
        teks += `{${i}}` + sp.literal.text;
      });
      const tanpaPemegang = teks.replace(/\{\d+\}/g, " ");
      if (manusia(teks) && /[A-Za-zÀ-ÿ]{2,}/.test(tanpaPemegang) && !TAILWIND.test(" " + tanpaPemegang) && !/^[\s{}\d/]*\//.test(teks)) {
        const exprs = node.templateSpans.map((sp) => sp.expression);
        exprs.forEach(lawat);
        sunting.push({
          s: node.getStart(),
          e: node.getEnd(),
          bina: (render) => `tr(${esc(teks)}${exprs.map((x) => ", " + render(x.getStart(), x.getEnd())).join("")})`,
        });
        return;
      }
    }
    ts.forEachChild(node, lawat);
  }
  lawat(sf);
  if (!sunting.length) return 0;

  sunting.sort((a, b) => a.s - b.s || b.e - a.e);
  function render(s, e) {
    let out = "";
    let i = s;
    for (const x of sunting) {
      if (x.s < i || x.e > e || x.s < s) continue;
      out += src.slice(i, x.s) + x.bina(render);
      i = x.e;
    }
    return out + src.slice(i, e);
  }
  let hasil = render(0, src.length);
  if (!/import \{[^}]*\btr\b[^}]*\} from "@\/lib\/i18n"/.test(hasil)) {
    const m = hasil.match(/^(\s*["']use (client|server)["'];?\s*\n)/);
    const imp = 'import { tr } from "@/lib/i18n";\n';
    hasil = m ? m[1] + imp + hasil.slice(m[1].length) : imp + hasil;
  }
  if (!kering) fs.writeFileSync(fail, hasil);
  return sunting.length;
}

function semuaFail(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return semuaFail(p);
    return /\.(tsx?)$/.test(d.name) && !KECUALI.some((r) => r.test(p)) ? [p] : [];
  });
}

const args = process.argv.slice(2);
if (args.includes("--keys")) {
  const kunci = new Set();
  for (const f of semuaFail(ROOT)) {
    const s = fs.readFileSync(f, "utf8");
    const sf = ts.createSourceFile(f, s, ts.ScriptTarget.Latest, true, f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    (function cari(n) {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "tr" && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0]))
        kunci.add(n.arguments[0].text);
      ts.forEachChild(n, cari);
    })(sf);
  }
  process.stdout.write(JSON.stringify([...kunci].sort(), null, 0));
  process.exit(0);
}
const kering = args.includes("--dry");
const sasaran = args.filter((a) => !a.startsWith("--"));
const fail = sasaran.length ? sasaran.map((a) => path.resolve(a)) : semuaFail(ROOT);
let jumlah = 0;
for (const f of fail) {
  const n = proses(f, kering);
  if (n) {
    jumlah += n;
    if (kering) console.log(n, path.relative(ROOT, f));
  }
}
console.log(`${kering ? "[kering] " : ""}${jumlah} teks dibungkus dalam ${fail.length} fail`);
