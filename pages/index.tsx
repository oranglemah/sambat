// pages/index.tsx
import { useEffect, useState } from "react";

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

function normalizePhone(input: string): string {
  let num = input.trim();
  num = num.replace(/[^0-9]/g, "");
  if (num.startsWith("08")) {
    num = "62" + num.substring(1);
  }
  return num;
}

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

      const resp = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msisdn }),
      });

      const data = await resp.json();

      if (!data.success) {
        setErrorMessage(data.message || "Gagal request OTP");
        return;
      }

      setSubscriberId(data.subscriber_id || null);
      setStatusMessage("OTP berhasil dikirim. Cek SMS Anda.");
    } catch (err: any) {
      console.error("Error request OTP:", err);
      setErrorMessage(err?.message || "Gagal request OTP.");
    } finally {
      setLoadingOtp(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleSubmitOtp = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    const msisdn = normalizePhone(phoneNumber);
    if (!msisdn) {
      setErrorMessage("Nomor belum diisi.");
      return;
    }
    if (!/^\d{6}$/.test(otpCode)) {
      setErrorMessage("OTP harus 6 digit angka.");
      return;
    }

    try {
      setVerifyingOtp(true);
      setStatusMessage("Memverifikasi OTP...");

      const resp = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msisdn, otp: otpCode }),
      });

      const data = await resp.json();

      if (!data.success) {
        setErrorMessage(data.message || "Login gagal.");
        return;
      }

      setTokens(data.tokens);
      setStatusMessage("Berhasil login!");

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "myxl_session",
          JSON.stringify({
            tokens: data.tokens,
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

      const resp = await fetch("/api/my-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await resp.json();

      if (!data.success) {
        setErrorMessage(data.message || "Gagal mengambil paket.");
        return;
      }

      const quotas = data.data?.data?.quotas || [];
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
          familyCode: "N/A",
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

  const isLoggedIn = !!tokens;

  return (
    <div className="container">
      <div className="card">
        <img src="https://sambat.xyz/gojohd.jpg" alt="Logo" className="logo" />
        <h1>MyXL CLI Web UI</h1>
        <p className="subtitle">Versi web dari me-cli-sunset (Menu 1 & 2)</p>

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
            <button className="button logout" onClick={handleLogout}>
              Logout
            </button>
          </>
        )}

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

        {statusMessage && <p className="status">{statusMessage}</p>}
        {errorMessage && <p className="error">{errorMessage}</p>}
      </div>

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
