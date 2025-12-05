import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: "Nomor dan OTP wajib diisi." });
  }

  const payload = {
    msisdn: phone.startsWith("628") ? phone : phone.replace(/^0/, "62"),
    otp,
    deviceId: process.env.AX_DEVICE_ID,
    appVersion: "8.9.0",
  };

  try {
    const response = await fetch(`${process.env.BASE_CIAM_URL}/v1/device/auth/verify-otp`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Basic ${process.env.BASIC_AUTH}`,
        "user-agent": process.env.UA || "",
        "x-device-id": process.env.AX_DEVICE_ID || "",
        "x-fp-key": process.env.AX_FP_KEY || "",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.status !== "SUCCESS") {
      return res.status(400).json({ error: result.message || "Login gagal" });
    }

    const accessToken = result.data?.accessToken || "";
    res.status(200).json({ token: accessToken });
  } catch (err) {
    res.status(500).json({ error: "Gagal login. Server error." });
  }
}
