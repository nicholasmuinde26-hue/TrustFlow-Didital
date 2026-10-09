import React from "react";
import { Printer, MessageCircle, Copy, X, CheckCircle2 } from "lucide-react";

const CHANNEL_LABEL = { cash: "Cash", mpesa: "M-Pesa", till: "Card / Till", paybill: "Paybill", bank: "Bank" };

const money = (value, currency) => `${currency} ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function paymentLine(receipt) {
  const label = CHANNEL_LABEL[receipt.payment_channel] || receipt.payment_channel;
  if (receipt.payment_channel === "mpesa") {
    if (receipt.mpesa_receipt_number) return `${label} · ${receipt.mpesa_receipt_number}`;
    return receipt.mpesa_prompt_sent ? `${label} · payment prompt sent to customer` : label;
  }
  return label;
}

function receiptText(receipt) {
  const c = receipt.business.currency;
  const lines = [
    receipt.business.name,
    receipt.business.location,
    `Receipt ${receipt.receipt_number}`,
    new Date(receipt.issued_at).toLocaleString("en-KE"),
    "",
    ...receipt.items.map((l) => `${l.qty} x ${l.name} — ${money(l.total, c)}`),
    "",
    receipt.discount > 0 ? `Discount: -${money(receipt.discount, c)}` : null,
    `Total: ${money(receipt.total, c)}`,
    `Paid by: ${paymentLine(receipt)}`,
    "",
    "Thank you for shopping with us.",
  ];
  return lines.filter((l) => l !== null && l !== undefined).join("\n");
}

function printReceipt(receipt) {
  const c = receipt.business.currency;
  const rows = receipt.items.map((l) => `<tr><td>${escapeHtml(l.name)}<br><small>${l.qty} × ${escapeHtml(money(l.price, c))}</small></td><td class="r">${escapeHtml(money(l.total, c))}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(receipt.receipt_number)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font: 12px/1.4 "Courier New", monospace; width: 72mm; margin: 0 auto; color: #000; }
  h1 { font-size: 15px; text-align: center; margin: 0 0 2px; }
  .c { text-align: center; } .r { text-align: right; white-space: nowrap; vertical-align: top; }
  table { width: 100%; border-collapse: collapse; } td { padding: 3px 0; } small { color: #444; }
  hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
  .tot td { font-weight: bold; font-size: 14px; }
</style></head><body>
  <h1>${escapeHtml(receipt.business.name)}</h1>
  ${receipt.business.location ? `<div class="c">${escapeHtml(receipt.business.location)}</div>` : ""}
  ${receipt.business.tax_id ? `<div class="c">PIN: ${escapeHtml(receipt.business.tax_id)}</div>` : ""}
  <hr>
  <div>Receipt: ${escapeHtml(receipt.receipt_number)}</div>
  <div>Date: ${escapeHtml(new Date(receipt.issued_at).toLocaleString("en-KE"))}</div>
  ${receipt.cashier ? `<div>Served by: ${escapeHtml(receipt.cashier)}</div>` : ""}
  ${receipt.customer_name ? `<div>Customer: ${escapeHtml(receipt.customer_name)}</div>` : ""}
  <hr>
  <table>${rows}</table>
  <hr>
  <table>
    ${receipt.discount > 0 ? `<tr><td>Subtotal</td><td class="r">${escapeHtml(money(receipt.subtotal, c))}</td></tr><tr><td>Discount</td><td class="r">-${escapeHtml(money(receipt.discount, c))}</td></tr>` : ""}
    <tr class="tot"><td>TOTAL</td><td class="r">${escapeHtml(money(receipt.total, c))}</td></tr>
  </table>
  <div>Paid by: ${escapeHtml(paymentLine(receipt))}</div>
  <hr>
  <div class="c">Thank you for shopping with us.</div>
</body></html>`;

  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onload = () => { win.print(); };
  setTimeout(() => { try { win.print(); } catch { /* window already closed */ } }, 400);
  return true;
}

// 07XXXXXXXX / 7XXXXXXXX / +2547XXXXXXXX -> 2547XXXXXXXX for wa.me
function whatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

export default function PosReceiptModal({ receipt, onClose }) {
  const [copied, setCopied] = React.useState(false);
  const [printBlocked, setPrintBlocked] = React.useState(false);
  if (!receipt) return null;

  const c = receipt.business.currency;
  const waNumber = whatsappNumber(receipt.customer_phone);

  const copy = async () => {
    try { await navigator.clipboard.writeText(receiptText(receipt)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Sale receipt">
      <div className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={16} />Sale completed</span>
          <button type="button" onClick={onClose} aria-label="Close receipt" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
            <p className="text-center text-sm font-bold">{receipt.business.name}</p>
            {receipt.business.location && <p className="text-center">{receipt.business.location}</p>}
            {receipt.business.tax_id && <p className="text-center">PIN: {receipt.business.tax_id}</p>}
            <hr className="my-2 border-dashed border-gray-300 dark:border-gray-700" />
            <p>Receipt: {receipt.receipt_number}</p>
            <p>Date: {new Date(receipt.issued_at).toLocaleString("en-KE")}</p>
            {receipt.cashier && <p>Served by: {receipt.cashier}</p>}
            <hr className="my-2 border-dashed border-gray-300 dark:border-gray-700" />
            {receipt.items.map((line, i) => (
              <div key={`${line.item_id}-${i}`} className="flex justify-between gap-3 py-0.5">
                <span className="min-w-0">{line.name}<br /><span className="text-gray-500">{line.qty} × {money(line.price, c)}</span></span>
                <span className="shrink-0">{money(line.total, c)}</span>
              </div>
            ))}
            <hr className="my-2 border-dashed border-gray-300 dark:border-gray-700" />
            {receipt.discount > 0 && (<>
              <div className="flex justify-between"><span>Subtotal</span><span>{money(receipt.subtotal, c)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>-{money(receipt.discount, c)}</span></div>
            </>)}
            <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{money(receipt.total, c)}</span></div>
            <p className="mt-1">Paid by: {paymentLine(receipt)}</p>
            <hr className="my-2 border-dashed border-gray-300 dark:border-gray-700" />
            <p className="text-center">Thank you for shopping with us.</p>
          </div>
          {printBlocked && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Your browser blocked the print window. Allow pop-ups for this site and try again.</p>}
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
          <button type="button" onClick={() => setPrintBlocked(!printReceipt(receipt))} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-gray-900 text-xs font-bold text-white dark:bg-white dark:text-gray-900"><Printer size={14} />Print</button>
          {waNumber
            ? <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(receiptText(receipt))}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200"><MessageCircle size={14} />WhatsApp</a>
            : <button type="button" onClick={copy} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200"><Copy size={14} />{copied ? "Copied" : "Copy"}</button>}
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">New sale</button>
        </div>
      </div>
    </div>
  );
}
