// pages/api/otp.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

// Ambil env (pakai fallback minimal biar tidak undefined)
const BASE_CIAM_URL =
  process.env.BASE_CIAM_URL || "https://gede.ciam.xlaxiata.co.id";
const BASIC_AUTH = process.env.BASIC_AUTH || "";
const AX_DEVICE_ID = process.env.AX_DEVICE_ID || "";
const AX_FP = process.env.AX_FP_KEY || process.env.AX_FP || "";
const UA =
  process.env.UA ||
  "myXL / 8.9.0(1202); com.android.vending; (samsung; SM-N935F; SDK 33; Android 13";

// Timestamp mirip java_like_timestamp: 2023-10-20T12:34:56.78+07:00
function javaLikeTimestampGmt7(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const gmt7 = new Date(utc + 7 * 60 * 60000);

  const year = gmt7.getFullYear();
  const month = String(gmt7.getMonth() + 1).padStart(2, "0");
  const day = String(gmt7.getDate()).padStart(2, "0");
  const hour = String(gmt7.getHours()).padStart(2, "0");
  const minute = String(gmt7.getMinutes()).padStart(2, "0");
  const second = String(gmt7.getSeconds()).padStart(2, "0");
  const ms = gmt7.getMilliseconds();
  const fraction = String(Math.floor(ms / 10)).padStart(2, "0"); // 2 digit

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${fraction}+07:00`;
}

function normalizeMsisdn(raw: string): string {
  let num = raw.trim().replace(/[^0-9]/g, ""); // buang spasi & non angka
  if (num.startsWith("08")) {
    num = "62" + num.substring(1); // 08xxxx -> 628xxxx
  }
  return num;
}

function isValidMsisdn(msisdn: string): boolean {
  return msisdn.startsWith("62") && msisdn.length >= 10 && msisdn.length <= 14;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ error: "Method not allowed, gunakan POST." });
  }

  const { phone } = req.body as { phone?: string };

  if (!phone) {
    return res.status(400).json({ error: "Nomor telepon wajib diisi." });
  }

  const msisdn = normalizeMsisdn(phone);

  if (!isValidMsisdn(msisdn)) {
    return res.status(400).json({
      error:
        "Nomor tidak valid. Pastikan diawali 08 / 628 dan panjang antara 10–14 digit.",
    });
  }

  if (!BASIC_AUTH || !AX_DEVICE_ID || !AX_FP) {
    console.error("[OTP] Env kurang:", {
      hasBasic: !!BASIC_AUTH,
      hasDev: !!AX_DEVICE_ID,
      hasFp: !!AX_FP,
    });
    return res.status(500).json({
      error:
        "Konfigurasi server belum lengkap (BASIC_AUTH / AX_DEVICE_ID / AX_FP_KEY).",
    });
  }

  try {
    const ts = javaLikeTimestampGmt7();
    const url = new URL(`${BASE_CIAM_URL}/realms/xl-ciam/auth/otp`);
    url.searchParams.set("contact", msisdn);
    url.searchParams.set("contactType", "SMS");
    url.searchParams.set("alternateContact", "false");

    const host = (() => {
      try {
        return new URL(BASE_CIAM_URL).host;
      } catch {
        return BASE_CIAM_URL.replace(/^https?:\/\//, "");
      }
    })();

    const headers: Record<string, string> = {
      "Accept-Encoding": "gzip, deflate, br",
      Authorization: `Basic ${BASIC_AUTH}`,
      "Ax-Device-Id": AX_DEVICE_ID,
      "Ax-Fingerprint": AX_FP,
      "Ax-Request-At": ts,
      "Ax-Request-Device": "samsung",
      "Ax-Request-Device-Model": "SM-N935F",
      "Ax-Request-Id": crypto.randomUUID(),
      "Ax-Substype": "PREPAID",
      "Content-Type": "application/json",
      Host: host,
      "User-Agent": UA,
    };

    // GET seperti di Python (requests.get)
    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    const text = await response.text();
    console.log("[OTP RAW RESPONSE]", response.status, text);

    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Bukan JSON -> kemungkinan halaman HTML Cloudflare / error lain
      return res.status(500).json({
        error: "Respons OTP bukan JSON (mungkin diblokir Cloudflare).",
        statusCode: response.status,
        raw: text,
      });
    }

    console.log("[OTP JSON]", data);

    // Kalau server balas status beda "SUCCESS", kirim ke client
    if (!response.ok || (data.status && data.status !== "SUCCESS")) {
      return res.status(400).json({
        error: data.message || "Gagal request OTP",
        statusCode: response.status,
        raw: data,
      });
    }

    // CLI aslinya cuma butuh subscriber_id, tapi di UI kita cukup info sukses
    return res.status(200).json({
      success: true,
      subscriber_id: data.subscriber_id,
      raw: data,
    });
  } catch (err: any) {
    console.error("[OTP ERROR]", err);
    return res.status(500).json({
      error: "Terjadi kesalahan server saat request OTP.",
      detail: err?.message || String(err),
    });
  }
}
