import { useEffect, useState } from "react";

// ===================== KONSTANTA (SAMAKAN DENGAN .env PYTHON) =====================

const BASE_CIAM_URL = "https://gede.ciam.xlaxiata.co.id";
const BASE_API_URL = "https://api.myxl.xlaxiata.co.id";
const BASIC_AUTH =
  "OWZjOTdlZDEtNmEzMC00OGQ1LTk1MTYtNjBjNTNjZTNhMTM1OllEV21GNExKajlYSUt3UW56eTJlMmxiMHRKUWIyOW8z";
const AX_DEVICE_ID = "92fb44c0804233eb4d9e29f838223a14";
const AX_FP = "18b4d589826af50241177961590e6693";
const UA =
  "myXL / 8.9.0(1202); com.android.vending; (samsung; SM-N935F; SDK 33; Android 13";
const API_KEY = "vT8tINqHaOxXbGE7eOWAhA==";
const AES_KEY_ASCII = "5dccbf08920a5527";

// ===================== TIPE DATA =====================

type BenefitView = {
  id: string;
  name: string;
  type: string;
  remaining: string;
  total: string;
};

type MyPackageView = {
  number: number;
  name: string;
  quotaCode: string;
  groupName: string;
  groupCode: string;
  familyCode?: string;
  benefits: BenefitView[];
};

// ===================== HELPER WAKTU + SIGNATURE =====================

function buildGmt7Date(offsetMinutes = 0): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + (7 * 60 + offsetMinutes) * 60000);
}

function formatTimestampGmt7(withColon: boolean, offsetMinutes = 0): string {
  const d = buildGmt7Date(offsetMinutes);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  const second = String(d.getSeconds()).padStart(2, "0");
  const ms = d.getMilliseconds();
  const fraction = String(Math.floor(ms / 10)).padStart(2, "0");
  const tz = withColon ? "+07:00" : "+0700";
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${fraction}${tz}`;
}

// Kurang lebih mirip ax_api_signature(api_key, ts_for_sign, contact, code, type)
async function generateSignature(
  apiKeyBase64: string,
  timestampNoColon: string,
  contact: string,
  code: string,
  contactType: string
): Promise<string> {
  const apiKeyRaw = atob(apiKeyBase64); // decode API_KEY dari base64
  const text = apiKeyRaw + timestampNoColon + contact + code + contactType;

  const enc = new TextEncoder();
  const keyBytes = enc.encode(AES_KEY_ASCII); // pakai AES_KEY_ASCII sebagai key HMAC

  if (typeof window === "undefined" || !("crypto" in window) || !window.crypto.subtle) {
    // kalau di server/SSR, jangan generate apa-apa
    return "";
  }

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuf = await window.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    enc.encode(text)
  );
  const sigBytes = new Uint8Array(sigBuf);
  let binary = "";
  for (const b of sigBytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

// ===================== HELPER KUOTA & NOMOR =====================

function formatQuotaByte(value: number): string {
  if (!value || value <= 0) return "0 B";

  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;

  if (value >= GB) {
    return `${(value / GB).toFixed(2)} GB`;
  } else if (value >= MB) {
    return `${(value / MB).toFixed(2)} MB`;
  } else if (value >= KB) {
    return `${(value / KB).toFixed(2)} KB`;
  } else {
    return `${value} B`;
  }
}

// terima 08xxxx atau 628xxxx → balikin 628xxxx
function normalizePhone(input: string): string {
  let num = input.trim();
  num = num.replace(/[^0-9]/g, "");
  if (num.startsWith("08")) {
    num = "62" + num.substring(1);
  }
  return num;
}

// ===================== KOMPONEN UTAMA =====================

const HomePage = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [subscriberId, setSubscriberId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<any | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [myPackages, setMyPackages] = useState<MyPackageView[]>([]);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Restore session dari localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("myxl_session");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.tokens) {
        setTokens(parsed.tokens);
        setPhoneNumber(parsed.msisdn || "");
        setSubscriberId(parsed.subscriberId || null);
      }
    } catch (e) {
      console.warn("Gagal parse myxl_session:", e);
    }
  }, []);

  // ===================== REQUEST OTP (MENU 1 - LANGKAH 1) =====================

  const handleRequestOtp = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    const msisdn = normalizePhone(phoneNumber);
    if (!/^62\d{8,13}$/.test(msisdn)) {
      setErrorMessage(
        "Nomor tidak valid. Pastikan diawali 08 / 628 dan panjangnya benar."
      );
      return;
    }

    try {
      setLoadingOtp(true);
      setStatusMessage("Mengirim OTP...");

      const tsHeader = formatTimestampGmt7(true); // dengan colon, mirip java_like_timestamp

      const url = `${BASE_CIAM_URL}/realms/xl-ciam/auth/otp?contact=${msisdn}&contactType=SMS&alternateContact=false`;

      const headers: Record<string, string> = {
        "Accept-Encoding": "gzip, deflate, br",
        Authorization: `Basic ${BASIC_AUTH}`,
        "Ax-Device-Id": AX_DEVICE_ID,
        "Ax-Fingerprint": AX_FP,
        "Ax-Request-At": tsHeader,
        "Ax-Request-Device": "samsung",
        "Ax-Request-Device-Model": "SM-N935F",
        "Ax-Request-Id":
          typeof window !== "undefined" && "crypto" in window && "randomUUID" in window.crypto
            ? window.crypto.randomUUID()
            : String(Date.now()),
        "Ax-Substype": "PREPAID",
        "Content-Type": "application/json",
        "User-Agent": UA,
      };

      const resp = await fetch(url, { method: "GET", headers });
      const data = await resp.json();

      if (!resp.ok || !data.subscriber_id) {
        console.error("OTP gagal:", data);
        throw new Error(data.error || "Gagal request OTP");
      }

      setSubscriberId(data.subscriber_id);
      setStatusMessage("OTP berhasil dikirim. Cek SMS Anda.");
    } catch (err: any) {
      console.error("Error request OTP:", err);
      setErrorMessage(
        err?.message || "Gagal mengirim OTP. Coba lagi beberapa saat."
      );
    } finally {
      setLoadingOtp(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // ===================== SUBMIT OTP (MENU 1 - LANGKAH 2) =====================

  const handleSubmitOtp = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    const msisdn = normalizePhone(phoneNumber);
    if (!subscriberId) {
      setErrorMessage("Silakan request OTP dulu.");
      return;
    }
    if (!/^\d{6}$/.test(otpCode)) {
      setErrorMessage("OTP harus 6 digit angka.");
      return;
    }

    try {
      setVerifyingOtp(true);
      setStatusMessage("Memverifikasi OTP...");

      const tsForSign = formatTimestampGmt7(false); // tanpa colon
      const tsHeader = formatTimestampGmt7(false, -5); // mundur 5 menit mirip kode Python

      const signature = await generateSignature(
        API_KEY,
        tsForSign,
        msisdn,
        otpCode,
        "SMS"
      );

      const body = new URLSearchParams({
        contactType: "SMS",
        code: otpCode,
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
        "Ax-Request-Id":
          typeof window !== "undefined" && "crypto" in window && "randomUUID" in window.crypto
            ? window.crypto.randomUUID()
            : String(Date.now()),
        "Ax-Substype": "PREPAID",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      };

      const resp = await fetch(tokenUrl, {
        method: "POST",
        headers,
        body: body.toString(),
      });

      const data = await resp.json();

      if (!resp.ok || data.error) {
        console.error("OTP verify error:", data);
        throw new Error(
          data.error_description || "OTP salah / kadaluarsa. Coba lagi."
        );
      }

      setTokens(data);
      setStatusMessage("Berhasil login!");

      // Simpan sesi di localStorage
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "myxl_session",
          JSON.stringify({
            tokens: data,
            msisdn,
            subscriberId,
          })
        );
      }

      setOtpCode("");
    } catch (err: any) {
      console.error("Error submit OTP:", err);
      setErrorMessage(err?.message || "Gagal verifikasi OTP.");
    } finally {
      setVerifyingOtp(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // ===================== MENU 2: LIHAT PAKET SAYA =====================

  const handleFetchMyPackages = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (!tokens) {
      setErrorMessage("Silakan login dulu.");
      return;
    }

    const idToken: string | undefined = tokens.id_token;
    if (!idToken) {
      setErrorMessage("ID token tidak ditemukan. Silakan login ulang.");
      return;
    }

    try {
      setLoadingPackages(true);
      setStatusMessage("Mengambil paket...");

      const path = "api/v8/packages/quota-details";
      const payload = {
        is_enterprise: false,
        lang: "en",
        family_member_id: "",
      };

      const resp = await fetch(`${BASE_API_URL}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
          "User-Agent": UA,
        },
        body: JSON.stringify(payload),
      });

      const res = await resp.json();

      if (!resp.ok || res.status !== "SUCCESS") {
        console.error("Gagal fetch paket:", res);
        setErrorMessage("Gagal mengambil paket. Coba lagi.");
        return;
      }

      const quotas = res.data?.quotas || [];
      const mapped: MyPackageView[] = [];

      let num = 1;
      for (const quota of quotas) {
        const quotaCode = quota.quota_code as string;
        const groupCode = quota.group_code as string;
        const groupName = quota.group_name as string;
        const quotaName = quota.name as string;

        const benefitsRaw = quota.benefits || [];
        const benefits: BenefitView[] = benefitsRaw.map((b: any) => {
          const dataType = b.data_type || "N/A";
          const remaining = b.remaining ?? 0;
          const total = b.total ?? 0;

          let remStr = "";
          let totStr = "";

          if (dataType === "DATA") {
            remStr = formatQuotaByte(remaining);
            totStr = formatQuotaByte(total);
          } else if (dataType === "VOICE") {
            remStr = `${(remaining / 60).toFixed(2)} menit`;
            totStr = `${(total / 60).toFixed(2)} menit`;
          } else if (dataType === "TEXT") {
            remStr = `${remaining} SMS`;
            totStr = `${total} SMS`;
          } else {
            remStr = `${remaining}`;
            totStr = `${total}`;
          }

          return {
            id: b.id ?? "",
            name: b.name ?? "",
            type: dataType,
            remaining: remStr,
            total: totStr,
          };
        });

        mapped.push({
          number: num,
          name: quotaName,
          quotaCode,
          groupName,
          groupCode,
          familyCode: "N/A", // di CLI diambil dari get_package, nanti bisa disambung kalau mau
          benefits,
        });

        num += 1;
      }

      setMyPackages(mapped);
      setStatusMessage(null);
    } catch (err) {
      console.error("Error fetchMyPackages:", err);
      setErrorMessage("Terjadi error saat mengambil paket.");
    } finally {
      setLoadingPackages(false);
    }
  };

  // ===================== LOGOUT =====================

  const handleLogout = () => {
    setTokens(null);
    setSubscriberId(null);
    setMyPackages([]);
    setOtpCode("");

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("myxl_session");
    }

    setStatusMessage("Anda telah logout.");
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // ===================== RENDER UI =====================

  const isLoggedIn = !!tokens;

  return (
    <div className="container">
      <div className="card">
        {/* LOGO */}
        <img src="https://sambat.xyz/gojohd.jpg" alt="Logo" className="logo" />
        <h1>MyXL CLI Web UI</h1>
        <p className="subtitle">Versi web dari me-cli-sunset (Menu 1 & 2)</p>

        {/* FORM LOGIN (MENU 1) */}
        {!isLoggedIn && (
          <>
            <input
              type="tel"
              className="input"
              placeholder="Nomor XL (08 / 628...)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />

            {subscriberId && (
              <input
                type="text"
                className="input"
                placeholder="Masukkan OTP 6 digit"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
              />
            )}

            {!subscriberId ? (
              <button
                className="button"
                onClick={handleRequestOtp}
                disabled={loadingOtp}
              >
                {loadingOtp ? "Mengirim OTP..." : "Request OTP"}
              </button>
            ) : (
              <button
                className="button"
                onClick={handleSubmitOtp}
                disabled={verifyingOtp}
              >
                {verifyingOtp ? "Memverifikasi..." : "Submit OTP"}
              </button>
            )}
          </>
        )}

        {/* SETELAH LOGIN */}
        {isLoggedIn && (
          <>
            <p className="info">
              ✅ Login sebagai:{" "}
              <b>{normalizePhone(phoneNumber) || "MSISDN tidak diketahui"}</b>
            </p>
            <button
              className="button"
              onClick={handleFetchMyPackages}
              disabled={loadingPackages}
            >
              {loadingPackages ? "Memuat paket..." : "Lihat Paket Saya"}
            </button>
            <button
              className="button logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        )}

        {/* LIST PAKET (MENU 2) */}
        {myPackages.length > 0 && (
          <div className="packages">
            <h2>Paket Aktif</h2>
            {myPackages.map((pkg) => (
              <div key={pkg.number} className="package-card">
                <div className="package-header">
                  <span className="pkg-number">#{pkg.number}</span>
                  <span className="pkg-name">{pkg.name}</span>
                </div>
                <div className="package-meta">
                  <div>
                    <b>Group:</b> {pkg.groupName} ({pkg.groupCode})
                  </div>
                  <div>
                    <b>Quota Code:</b> {pkg.quotaCode}
                  </div>
                  <div>
                    <b>Family Code:</b> {pkg.familyCode || "N/A"}
                  </div>
                </div>
                <div className="package-benefits">
                  <b>Benefits:</b>
                  {pkg.benefits.length === 0 && (
                    <div>- Tidak ada detail benefit -</div>
                  )}
                  {pkg.benefits.map((b) => (
                    <div
                      key={b.id || b.name}
                      className="benefit-row"
                    >
                      <div>
                        {b.name}{" "}
                        <span className="benefit-type">({b.type})</span>
                      </div>
                      <div>
                        Kuota: {b.remaining} / {b.total}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STATUS & ERROR */}
        {statusMessage && <p className="status">{statusMessage}</p>}
        {errorMessage && <p className="error">{errorMessage}</p>}
      </div>

      {/* STYLE */}
      <style jsx>{`
        .container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: radial-gradient(circle at top, #4f46e5, #0f172a);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .card {
          background: rgba(15, 23, 42, 0.9);
          color: #e5e7eb;
          padding: 1.75rem;
          border-radius: 1.25rem;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.3);
          backdrop-filter: blur(18px);
        }

        .logo {
          display: block;
          margin: 0 auto 0.75rem;
          width: 80px;
          height: 80px;
          object-fit: cover;
          border-radius: 999px;
          border: 2px solid rgba(248, 250, 252, 0.8);
        }

        h1 {
          text-align: center;
          font-size: 1.4rem;
          margin-bottom: 0.25rem;
        }

        .subtitle {
          text-align: center;
          font-size: 0.8rem;
          color: #9ca3af;
          margin-bottom: 1.25rem;
        }

        .input {
          width: 100%;
          padding: 0.55rem 0.75rem;
          margin-bottom: 0.75rem;
          border-radius: 0.6rem;
          border: 1px solid rgba(148, 163, 184, 0.6);
          background: rgba(15, 23, 42, 0.7);
          color: #f9fafb;
          font-size: 0.9rem;
          outline: none;
        }

        .input:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.6);
        }

        .button {
          width: 100%;
          padding: 0.6rem 0.75rem;
          border-radius: 0.7rem;
          border: none;
          margin-bottom: 0.5rem;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          color: #f9fafb;
          transition: transform 0.08s ease, box-shadow 0.08s ease,
            filter 0.1s ease;
        }

        .button:hover {
          filter: brightness(1.07);
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.6);
          transform: translateY(-1px);
        }

        .button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .logout {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
        }

        .info {
          margin: 0.5rem 0;
          font-size: 0.85rem;
        }

        .packages {
          margin-top: 1.25rem;
          max-height: 320px;
          overflow-y: auto;
          padding-right: 0.3rem;
        }

        .packages h2 {
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .package-card {
          border-radius: 0.8rem;
          border: 1px solid rgba(148, 163, 184, 0.4);
          padding: 0.6rem 0.75rem;
          margin-bottom: 0.6rem;
          background: rgba(15, 23, 42, 0.7);
        }

        .package-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.25rem;
          font-size: 0.9rem;
        }

        .pkg-number {
          font-weight: 700;
          color: #a5b4fc;
        }

        .pkg-name {
          font-weight: 600;
        }

        .package-meta {
          font-size: 0.8rem;
          color: #9ca3af;
          margin-bottom: 0.4rem;
        }

        .package-benefits {
          font-size: 0.8rem;
        }

        .benefit-row {
          margin-top: 0.25rem;
          padding-left: 0.5rem;
          border-left: 2px solid #4f46e5;
        }

        .benefit-type {
          font-size: 0.75rem;
          color: #a5b4fc;
        }

        .status {
          margin-top: 0.6rem;
          font-size: 0.8rem;
          color: #e5e7eb;
        }

        .error {
          margin-top: 0.6rem;
          font-size: 0.8rem;
          color: #fecaca;
        }

        @media (max-width: 480px) {
          .card {
            padding: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default HomePage;
