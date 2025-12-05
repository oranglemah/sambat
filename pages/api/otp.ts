import type { NextApiRequest, NextApiResponse } from "next";

const BASE_CIAM_URL = process.env.BASE_CIAM_URL ?? "";
const BASIC_AUTH = process.env.BASIC_AUTH ?? "";
const AX_DEVICE_ID = process.env.AX_DEVICE_ID ?? "";
const AX_FP_KEY = process.env.AX_FP_KEY ?? "";
const UA =
  process.env.UA ??
  "myXL / 8.9.0(1202); com.android.vending; (samsung; SM-N935F; SDK 33; Android 13)";

// Versi sederhana java_like_timestamp(now) GMT+7
function javaLikeTimestampGmt7(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const gmt7 = new Date(utcMs + 7 * 60 * 60000);

  const y = gmt7.getFullYear();
  const m = String(gmt7.getMonth() + 1).padStart(2, "0");
  const d = String(gmt7.getDate()).padStart(2, "0");
  const hh = String(gmt7.getHours()).padStart(2, "0");
  const mm = String(gmt7.getMinutes()).padStart(2, "0");
  const ss = String(gmt7.getSeconds()).padStart(2, "0");
  const ms = gmt7.getMilliseconds();
  const centi = String(Math.floor(ms / 10)).padStart(2, "0"); // 2 digit

  return `${y}-${m}-${d}T${hh}:${mm}:${ss}.${centi}+07:00`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { phone, msisdn } = req.body as { phone?: string; msisdn?: string };

  let nomor = (msisdn || phone || "").trim();
  if (!nomor) {
    return res.status(400).json({
      success: false,
      message: "Nomor telepon wajib diisi.",
    });
  }

  // Boleh input 087xxxxx atau 6287xxxxx
  nomor = nomor.replace(/[^0-9]/g, "");
  if (nomor.startsWith("08")) {
    nomor = "62" + nomor.slice(1);
  }

  // Sama kayak validate_contact di Python: harus mulai 628 dan max 14 digit
  if (!nomor.startsWith("628") || nomor.length > 14) {
    return res.status(400).json({
      success: false,
      message: "Nomor tidak valid. Gunakan format 0877.. atau 62877.. (maks 14 digit).",
    });
  }

  try {
    const axRequestAt = javaLikeTimestampGmt7();
    const axRequestId = crypto.randomUUID();

    const url = new URL(`${BASE_CIAM_URL}/realms/xl-ciam/auth/otp`);
    url.searchParams.set("contact", nomor);
    url.searchParams.set("contactType", "SMS");
    url.searchParams.set("alternateContact", "false");

    const hostHeader = BASE_CIAM_URL.replace(/^https?:\/\//, "");

    const headers: Record<string, string> = {
      "Accept-Encoding": "gzip, deflate, br",
      Authorization: `Basic ${BASIC_AUTH}`,
      "Ax-Device-Id": AX_DEVICE_ID,
      "Ax-Fingerprint": AX_FP_KEY,
      "Ax-Request-At": axRequestAt,
      "Ax-Request-Device": "samsung",
      "Ax-Request-Device-Model": "SM-N935F",
      "Ax-Request-Id": axRequestId,
      "Ax-Substype": "PREPAID",
      "Content-Type": "application/json",
      Host: hostHeader,
      "User-Agent": UA,
    };

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    const text = await resp.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      // Kalau balikan HTML (misal Access denied Cloudflare), tetap kirim ke client
      return res.status(resp.ok ? 200 : 400).json({
        success: false,
        message: "Response bukan JSON dari CIAM (mungkin diblokir Cloudflare).",
        raw: text,
      });
    }

    console.log("[OTP] HTTP:", resp.status);
    console.log("[OTP] BODY:", data);

    // Logic sama seperti Python: harus ada subscriber_id
    if (!resp.ok || !data || !data.subscriber_id) {
      return res.status(400).json({
        success: false,
        message:
          data.error ||
          data.message ||
          `Gagal request OTP (HTTP ${resp.status}).`,
        raw: data,
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP berhasil dikirim.",
      subscriber_id: data.subscriber_id,
    });
  } catch (err: any) {
    console.error("[OTP] ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Terjadi kesalahan server saat request OTP.",
    });
  }
}
