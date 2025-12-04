// pages/api/otp.ts
import type { NextApiRequest, NextApiResponse } from "next";

const BASE_CIAM_URL =
  process.env.BASE_CIAM_URL || "https://gede.ciam.xlaxiata.co.id";
const BASIC_AUTH =
  process.env.BASIC_AUTH ||
  "OWZjOTdlZDEtNmEzMC00OGQ1LTk1MTYtNjBjNTNjZTNhMTM1OllEV21GNExKajlYSUt3UW56eTJlMmxiMHRKUWIyOW8z";
const AX_DEVICE_ID =
  process.env.AX_DEVICE_ID || "92fb44c0804233eb4d9e29f838223a14";
const AX_FP = process.env.AX_FP || "18b4d589826af50241177961590e6693";
const UA =
  process.env.UA ||
  "myXL / 8.9.0(1202); com.android.vending; (samsung; SM-N935F; SDK 33; Android 13";

function formatTimestampGmt7(): string {
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
  const fraction = String(Math.floor(ms / 10)).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${fraction}+07:00`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  const { msisdn } = req.body as { msisdn?: string };

  if (!msisdn || typeof msisdn !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "msisdn diperlukan" });
  }

  try {
    const tsHeader = formatTimestampGmt7();

    const url = new URL(
      `${BASE_CIAM_URL}/realms/xl-ciam/auth/otp`
    );
    url.searchParams.set("contact", msisdn);
    url.searchParams.set("contactType", "SMS");
    url.searchParams.set("alternateContact", "false");

    const headers: Record<string, string> = {
      "Accept-Encoding": "gzip, deflate, br",
      Authorization: `Basic ${BASIC_AUTH}`,
      "Ax-Device-Id": AX_DEVICE_ID,
      "Ax-Fingerprint": AX_FP,
      "Ax-Request-At": tsHeader,
      "Ax-Request-Device": "samsung",
      "Ax-Request-Device-Model": "SM-N935F",
      "Ax-Request-Id": String(Date.now()),
      "Ax-Substype": "PREPAID",
      "Content-Type": "application/json",
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
      return res.status(500).json({
        success: false,
        message: "Response bukan JSON (kemungkinan masih ke-block Cloudflare)",
        raw: text,
      });
    }

    if (!resp.ok || !data.subscriber_id) {
      return res.status(400).json({
        success: false,
        message: data.error || "Gagal request OTP",
        raw: data,
      });
    }

    return res.status(200).json({
      success: true,
      subscriber_id: data.subscriber_id,
      raw: data,
    });
  } catch (err: any) {
    console.error("OTP API error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Internal error",
    });
  }
}
