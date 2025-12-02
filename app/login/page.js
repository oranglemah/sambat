'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';

export default function Login() {
  const [step, setStep] = useState(1); // 1: Input Nomor, 2: Input OTP
  const [msisdn, setMsisdn] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRequestOtp = async () => {
    setLoading(true);
    // Call API Route
    const res = await fetch('/api/auth/otp', {
        method: 'POST',
        body: JSON.stringify({ msisdn })
    });
    const data = await res.json();
    setLoading(false);
    if (data.status === 'SUCCESS' || data.code === '000') {
        setStep(2);
    } else {
        alert('Gagal kirim OTP: ' + JSON.stringify(data));
    }
  };

  const handleSubmitOtp = async () => {
    setLoading(true);
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ msisdn, otp })
    });
    const data = await res.json();
    setLoading(false);

    if (data.status === 'SUCCESS' || data.data?.access_token) {
        // SIMPAN TOKEN DI LOCAL STORAGE (Pengganti file JSON)
        localStorage.setItem('xl_auth', JSON.stringify(data.data));
        router.push('/'); // Redirect ke Dashboard
    } else {
        alert('Login Gagal: ' + JSON.stringify(data));
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <Navbar />
      <div className="flex flex-col items-center justify-center pt-20 px-4">
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 w-full max-w-md shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 text-center text-blue-400">
            {step === 1 ? 'LOGIN / MASUK' : 'VERIFIKASI OTP'}
          </h2>

          {step === 1 ? (
            <>
              <label className="text-gray-400 text-sm mb-2 block">Nomor XL (628...)</label>
              <input 
                type="text" 
                value={msisdn}
                onChange={(e) => setMsisdn(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded p-3 mb-4 text-white focus:outline-none focus:border-blue-500"
                placeholder="62812345678"
              />
              <button 
                onClick={handleRequestOtp} 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition disabled:opacity-50"
              >
                {loading ? 'Mengirim...' : 'Minta OTP'}
              </button>
            </>
          ) : (
            <>
              <label className="text-gray-400 text-sm mb-2 block">Masukkan Kode OTP</label>
              <input 
                type="text" 
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded p-3 mb-4 text-white text-center tracking-[1em]"
                maxLength={6}
              />
              <button 
                onClick={handleSubmitOtp} 
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded transition disabled:opacity-50"
              >
                {loading ? 'Verifikasi...' : 'Login'}
              </button>
              <button onClick={() => setStep(1)} className="w-full mt-2 text-sm text-gray-500 hover:text-white">
                Ganti Nomor
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
