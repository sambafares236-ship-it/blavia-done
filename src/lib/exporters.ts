/** Generic CSV / PDF exporters used by Payments, Tax, Payroll History, etc. */

export const toCsv = (
  headers: string[],
  rows: (string | number)[][],
): string => {
  const escape = (v: string | number) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
};

export const downloadBlob = (filename: string, content: string, mime = "text/csv;charset=utf-8;") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) =>
  downloadBlob(filename, toCsv(headers, rows));

/** Lightweight printable-PDF: opens a new window with styled HTML and triggers print. */
export const printTableAsPdf = (opts: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
}) => {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return;
  const head = opts.headers.map((h) => `<th>${h}</th>`).join("");
  const body = opts.rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c, i) =>
              `<td class="${i >= opts.headers.length - 2 ? "amt" : ""}">${String(c ?? "")}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  win.document.write(`<!doctype html><html><head><title>${opts.title}</title>
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; padding: 32px; color: #0f172a; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      .sub { color: #64748b; font-size: 12px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; padding: 8px; border-bottom: 1px solid #e2e8f0; }
      td { padding: 8px; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
      td.amt { text-align: right; font-variant-numeric: tabular-nums; }
    </style></head><body>
    <h1>${opts.title}</h1>${opts.subtitle ? `<div class="sub">${opts.subtitle}</div>` : ""}
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
};
