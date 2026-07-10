import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { Platform, Linking } from "react-native";
import { Collection } from "@/src/api/client";
import { amountToWords, formatINR } from "@/src/utils/money";
import { MANDAL } from "@/src/config/mandal";
import { LOGO_BASE64 } from "@/src/utils/logoBase64";

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildReceiptHtml(c: Collection): string {
  const modeLabel = c.payment_mode === "cash" ? "Cash" : "UPI";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Receipt ${esc(c.receipt_no)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #1C1917; background: #FAFAF9; }
  .card { max-width: 560px; margin: 0 auto; background: #fff; border: 2px solid #FF671F; border-radius: 16px; overflow: hidden; }
  .band { background: linear-gradient(135deg, #FF671F, #FFB300); color: #fff; padding: 20px 24px; text-align: center; }
  .logo { width: 96px; height: 96px; border-radius: 50%; background: #fff; border: 4px solid #fff; padding: 4px; margin: 0 auto 10px; display: block; object-fit: contain; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
  .om { font-size: 14px; opacity: 0.95; letter-spacing: 1px; }
  .org { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; margin-top: 4px; }
  .ganpati { font-size: 12px; opacity: 0.95; margin-top: 2px; letter-spacing: 2px; font-weight: 700; }
  .sub { font-size: 11px; opacity: 0.9; margin-top: 6px; }
  .body { padding: 20px 24px; }
  .rn { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 1px dashed #E7E5E4; margin-bottom: 14px; }
  .rn .label { font-size: 10px; color: #57534E; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
  .rn .val { font-size: 18px; font-weight: 800; color: #FF671F; }
  .row { display: flex; justify-content: space-between; margin: 10px 0; }
  .row .k { color: #57534E; font-size: 13px; }
  .row .v { color: #1C1917; font-size: 14px; font-weight: 600; text-align: right; max-width: 60%; }
  .amt-box { margin-top: 16px; padding: 16px; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px; text-align: center; }
  .amt-label { font-size: 12px; color: #92400E; text-transform: uppercase; letter-spacing: 0.8px; }
  .amt-fig { font-size: 32px; font-weight: 800; color: #C7431A; margin-top: 4px; }
  .amt-words { font-size: 12px; color: #57534E; margin-top: 6px; font-style: italic; }
  .foot { padding: 16px 24px; text-align: center; background: #FAFAF9; border-top: 1px solid #E7E5E4; }
  .thanks { font-size: 14px; font-weight: 700; color: #FF671F; }
  .note { font-size: 11px; color: #8A8580; margin-top: 4px; }
  .tagline { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #E7E5E4; font-size: 13px; font-weight: 800; color: #C7431A; letter-spacing: 1px; }
  .contact { font-size: 11px; color: #57534E; margin-top: 4px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .badge.cash { background: #FEF3C7; color: #92400E; }
  .badge.upi { background: #DCFCE7; color: #166534; }
</style>
</head>
<body>
  <div class="card">
    <div class="band">
      <img src="${LOGO_BASE64}" class="logo" alt="Mandal logo" />
      <div class="om">॥ श्री गणेशाय नमः ॥</div>
      <div class="org">${esc(MANDAL.orgName)}</div>
      <div class="ganpati">${esc(MANDAL.ganpatiName)}</div>
      <div class="sub">Ganesh Festival — Donation Receipt</div>
    </div>
    <div class="body">
      <div class="rn">
        <div>
          <div class="label">Receipt No.</div>
          <div class="val">${esc(c.receipt_no)}</div>
        </div>
        <div style="text-align:right">
          <div class="label">Date</div>
          <div style="font-size:13px; font-weight:600">${esc(fmtDate(c.created_at))}</div>
        </div>
      </div>

      <div class="row"><span class="k">Donor Name</span><span class="v">${esc(c.donor_name)}</span></div>
      <div class="row"><span class="k">WhatsApp</span><span class="v">+91 ${esc(c.donor_phone)}</span></div>
      ${c.address ? `<div class="row"><span class="k">Address / Shop</span><span class="v">${esc(c.address)}</span></div>` : ""}
      <div class="row"><span class="k">Payment Mode</span><span class="v"><span class="badge ${c.payment_mode}">${modeLabel}</span></span></div>
      <div class="row"><span class="k">Collector</span><span class="v">${esc(c.collector_name)}</span></div>
      ${c.notes ? `<div class="row"><span class="k">Notes</span><span class="v">${esc(c.notes)}</span></div>` : ""}

      <div class="amt-box">
        <div class="amt-label">Amount Received</div>
        <div class="amt-fig">${esc(formatINR(c.amount))}</div>
        <div class="amt-words">${esc(amountToWords(c.amount))}</div>
      </div>
    </div>
    <div class="foot">
      <div class="thanks">🙏 Thank you for your kind contribution</div>
      <div class="note">${esc(MANDAL.blessing)}</div>
      <div class="tagline">${esc(MANDAL.tagline)}</div>
      <div class="contact">Mandal Contact: ${esc(MANDAL.contactWhatsAppE164)} (WhatsApp)</div>
    </div>
  </div>
</body>
</html>`;
}

export function buildWhatsAppMessage(c: Collection): string {
  const modeLabel = c.payment_mode === "cash" ? "Cash" : "UPI";
  return (
    `Namaste ${c.donor_name} 🙏\n\n` +
    `Thank you for your generous contribution of ${formatINR(c.amount)} to ${MANDAL.orgName} (${MANDAL.orgNameEn}) — ${MANDAL.ganpatiName} for Ganesh Festival.\n\n` +
    `Receipt No: ${c.receipt_no}\n` +
    `Payment: ${modeLabel}\n` +
    `Collector: ${c.collector_name}\n\n` +
    `For any queries, contact us on WhatsApp: ${MANDAL.contactWhatsAppE164}\n\n` +
    `${MANDAL.blessing} 🌺\n\n` +
    `${MANDAL.tagline}`
  );
}

export async function generateReceiptPdf(c: Collection): Promise<string> {
  const html = buildReceiptHtml(c);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

/**
 * Single "Share Receipt" flow:
 *   1. Copy the WhatsApp message (with tagline + mandal contact) to clipboard
 *      so the volunteer can paste it as the WhatsApp caption.
 *   2. Generate the PDF receipt.
 *   3. Open the native share sheet with the PDF (user picks WhatsApp).
 */
export async function shareReceipt(
  c: Collection,
): Promise<{ pdfUri: string; message: string }> {
  const message = buildWhatsAppMessage(c);
  try {
    await Clipboard.setStringAsync(message);
  } catch {}
  const pdfUri = await generateReceiptPdf(c);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(pdfUri, {
      mimeType: "application/pdf",
      dialogTitle: `Share Receipt ${c.receipt_no}`,
      UTI: "com.adobe.pdf",
    });
  } else if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(pdfUri, "_blank");
  }
  return { pdfUri, message };
}

/** Legacy helper — kept if we ever want to open a plain WhatsApp text link. */
export async function openWhatsAppText(
  phone: string,
  message: string,
): Promise<boolean> {
  const wa = `whatsapp://send?phone=91${phone}&text=${encodeURIComponent(message)}`;
  const web = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
  try {
    const can = await Linking.canOpenURL(wa);
    if (can) {
      await Linking.openURL(wa);
      return true;
    }
  } catch {}
  try {
    await Linking.openURL(web);
    return true;
  } catch {}
  return false;
}
