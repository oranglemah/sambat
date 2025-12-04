// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

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
const API_KEY = process.env.API_KEY || "vT8tINqHaOxXbGE7eOWAhA==";
const AES_KEY_ASCII = process.env.AES_KEY_ASCII || "5dccbf08920a5527";

function formatTimestampNoColonGmt7(offsetMinutes = 0): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const gmt7 = new Date(utc + (7 * 60 + offsetMinutes) * 60000);
  const year = gmt7.getFullYear();
  const month = String(gmt7.getMonth() + 1).padStart(2, "0");
  const day = String(gmt7.getDate()).padStart(2, "0");
  const hour = String(gmt7.getHours()).padStart(2, "0");
  const minute = String(gmt7.getMinutes()).padStart(2, "0");
  const second = String(gmt7.getSeconds()).padStart(2, "0");
  const ms = gmt7.getMilliseconds();
  const fraction = String(Math.floor(ms / 10)).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${fraction}+0700`;
}

function decryptApiKey(apiKeyBase64: string, aesKeyAscii: string): Buffer {
  const encrypted = Buffer.from(apiKeyBase64, "base64");
  const key = Buffer.from(aesKeyAscii, "ascii"); // 16 byte
  const decipher = crypto.createDecipheriv("aes-128-ecb", key, null);
  decipher.setAutoPadding(true);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted;
}

function buildSignature(
  msisdn: string,
  otp: string,
  contactType: string,
  tsForSign: string
): string {
  try {
    const key = decryptApiKey(API_KEY, AES_KEY_ASCII);
    // Tebakan paling umum: sign ts + contact + code + type
    const msg = tsForSign + msisdn + otp + contactType;
    const hmac = crypto.createHmac("sha256", key).update(msg, "utf8").digest("base64");
    return hmac;
  } catch (err) {
    console.error("Error buildSignature:", err);
    return "";
  }
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

  const { msisdn, otp } = req.body as { msisdn?: string; otp?: string };

  if (!msisdn || !otp) {
    return res
      .status(400)
      .json({ success: false, message: "msisdn dan otp diperlukan" });
  }

  try {
    const contactType = "SMS";
    const tsForSign = formatTimestampNoColonGmt7(); // sekarang
    const tsHeader = formatTimestampNoColonGmt7(-5); // minus 5 menit

    const signature = buildSignature(msisdn, otp, contactType, tsForSign);

    const body = new URLSearchParams({
      contactType,
      code: otp,
      grant_type: "password",
      contact: msisdn,
      scope: "openid",
    });

    const tokenUrl = `${BASE_CIAM_URL}/realms/xl-ciam/protocol/openid-connect/token`;

    const headers: Record<string, string> = {
      "Accept-Encoding": "gzip, deflate, br",
      Authorization: `Basic ${BASIC_AUTH}`,
      "Ax-Api-Signature": signature,
      "Ax-Device-Id": AX_DEVICE_ID,
      "Ax-Fingerprint": AX_FP,
      "Ax-Request-At": tsHeader,
      "Ax-Request-Device": "samsung",
      "Ax-Request-Device-Model": "SM-N935F",
      "Ax-Request-Id": String(Date.now()),
      "Ax-Substype": "PREPAID",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    };

    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers,
      body: body.toString(),
    });

    const text = await resp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        success: false,
        message: "Response login bukan JSON",
        raw: text,
      });
    }

    if (!resp.ok || data.error) {
      return res.status(400).json({
        success: false,
        message: data.error_description || data.error || "Login gagal",
        raw: data,
      });
    }

    // data berisi access_token, id_token, refresh_token, dll
    return res.status(200).json({
      success: true,
      tokens: data,
    });
  } catch (err: any) {
    console.error("Login API error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Internal error",
    });
  }
}
