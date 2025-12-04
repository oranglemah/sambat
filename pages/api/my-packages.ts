// pages/api/my-packages.ts
import type { NextApiRequest, NextApiResponse } from "next";

const BASE_API_URL =
  process.env.BASE_API_URL || "https://api.myxl.xlaxiata.co.id";
const API_KEY = process.env.API_KEY || "vT8tINqHaOxXbGE7eOWAhA==";
const UA =
  process.env.UA ||
  "myXL / 8.9.0(1202); com.android.vending; (samsung; SM-N935F; SDK 33; Android 13";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    return res
      .status(400)
      .json({ success: false, message: "idToken diperlukan" });
  }

  try {
    const path = "api/v8/packages/quota-details";

    const payload = {
      is_enterprise: false,
      lang: "en",
      family_member_id: "",
    };

    const url = `${BASE_API_URL}/${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${idToken}`,
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
      "User-Agent": UA,
    };

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        success: false,
        message: "Response paket bukan JSON",
        raw: text,
      });
    }

    if (!resp.ok || data.status !== "SUCCESS") {
      return res.status(400).json({
        success: false,
        message: data.message || "Gagal mengambil paket",
        raw: data,
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    console.error("MyPackages API error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Internal error",
    });
  }
}
