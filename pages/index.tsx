import { useState } from "react";

export default function Home() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"input" | "otp" | "done">("input");

  const sendOtp = async () => {
    setLoading(true);
    const res = await fetch("/api/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      alert("OTP dikirim!");
      setStep("otp");
    } else {
      alert(data.error);
    }
  };

  const login = async () => {
    setLoading(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setToken(data.token);
      fetchPackages(data.token);
    } else {
      alert(data.error);
    }
  };

  const fetchPackages = async (token: string) => {
    setLoading(true);
    const res = await fetch("/api/my-packages", {
      headers: { token },
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setPackages(data.packages);
      setStep("done");
    } else {
      alert(data.error);
    }
  };

  return (
    <main className="p-6 font-mono text-sm max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🧪 MyXL Checker</h1>

      {step === "input" && (
        <>
          <input
            type="text"
            placeholder="08xxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border rounded p-2 w-full mb-2"
          />
          <button onClick={sendOtp} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
            {loading ? "Mengirim..." : "Kirim OTP"}
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <input
            type="text"
            placeholder="Kode OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="border rounded p-2 w-full mb-2"
          />
          <button onClick={login} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded">
            {loading ? "Login..." : "Login"}
          </button>
        </>
      )}

      {step === "done" && (
        <div className="mt-4">
          <h2 className="font-bold mb-2">📦 Paket Aktif:</h2>
          <ul className="space-y-1">
            {packages.map((pkg, i) => (
              <li key={i} className="border p-2 rounded">
                {pkg.packageName || "Paket"} - {pkg.remainingQuota} {pkg.unit}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
