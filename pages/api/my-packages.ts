import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.headers;

  if (!token || typeof token !== "string") {
    return res.status(401).json({ error: "Token tidak ditemukan." });
  }

  try {
    const response = await fetch(`${process.env.BASE_API_URL}/package/my`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "user-agent": process.env.UA || "",
        "x-device-id": process.env.AX_DEVICE_ID || "",
        "x-fp-key": process.env.AX_FP_KEY || "",
      },
    });

    const data = await response.json();

    if (data.status !== "SUCCESS") {
      return res.status(400).json({ error: data.message || "Gagal mengambil data paket." });
    }

    res.status(200).json({ packages: data.data });
  } catch (err) {
    res.status(500).json({ error: "Server error saat mengambil paket." });
  }
}
