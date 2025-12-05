import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: "Nomor telepon wajib diisi." });
  }

  try {
    const response = await fetch(`${process.env.BASE_CIAM_URL}/v1/device/auth/send-otp`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Basic ${process.env.BASIC_AUTH}`,
        "user-agent": process.env.UA || "",
        "x-device-id": process.env.AX_DEVICE_ID || "",
        "x-fp-key": process.env.AX_FP_KEY || "",
      },
      body: JSON.stringify({
        msisdn: phone.startsWith("628") ? phone : phone.replace(/^0/, "62"),
        deviceId: process.env.AX_DEVICE_ID,
      }),
    });

    const data = await response.json();

    if (data.status !== "SUCCESS") {
      return res.status(400).json({ error: data.message || "Gagal mengirim OTP" });
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: "Terjadi kesalahan server." });
  }
}
