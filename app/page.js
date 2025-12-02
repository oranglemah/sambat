'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './components/Navbar';

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper convert byte to GB (Logic dari package.py)
  const formatQuota = (bytes) => {
    if (bytes >= 1e9) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
    if (bytes >= 1e6) return (bytes / 1024 ** 2).toFixed(2) + ' MB';
    return bytes + ' B';
  };

  useEffect(() => {
    const fetchData = async () => {
      const authData = localStorage.getItem('xl_auth');
      if (!authData) {
        router.push('/login');
        return;
      }
      
      const tokens = JSON.parse(authData);
      
      try {
        // 1. Fetch Profile & Balance
        const resProfile = await fetch('/api/profile', {
            method: 'POST',
            body: JSON.stringify(tokens)
        });
        const dataProfile = await resProfile.json();
        setProfile(dataProfile.profile?.profile);
        setBalance(dataProfile.balance);

        // 2. Fetch Packages (Menu 2)
        const resPkg = await fetch('/api/packages', {
            method: 'POST',
            body: JSON.stringify({ id_token: tokens.id_token })
        });
        const dataPkg = await resPkg.json();
        setPackages(dataPkg.quotas || []);
        
      } catch (e) {
        console.error("Fetch error", e);
        // Jika token expired, redirect login (Logic auth.py refresh token belum dihandle disini untuk simplifikasi)
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading Data...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20">
      <Navbar />
      
      <main className="container mx-auto px-4 mt-6">
        
        {/* PROFILE SECTION */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 shadow-xl border border-gray-700 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <img src="https://sambat.xyz/gojohd.jpg" className="w-32 h-32 rounded-full" />
            </div>
            <h2 className="text-gray-400 text-sm uppercase tracking-widest mb-1">Nomor Anda</h2>
            <div className="text-3xl font-bold text-white mb-4">{profile?.msisdn}</div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 p-4 rounded-lg">
                    <div className="text-gray-400 text-xs">PULSA</div>
                    <div className="text-xl font-bold text-yellow-400">Rp {balance?.remaining?.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500">Exp: {balance?.expired_at}</div>
                </div>
                <div className="bg-black/30 p-4 rounded-lg">
                    <div className="text-gray-400 text-xs">TIPE</div>
                    <div className="text-xl font-bold text-blue-400">{profile?.subscription_type}</div>
                </div>
            </div>
        </div>

        {/* PACKAGES SECTION (MENU 2) */}
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
            PAKET SAYA
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg, idx) => (
                <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition duration-300">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h4 className="font-bold text-lg text-white leading-tight">{pkg.name}</h4>
                            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded mt-1 inline-block">
                                {pkg.group_name}
                            </span>
                        </div>
                    </div>
                    
                    <div className="space-y-3 mt-4">
                        {pkg.benefits?.map((benefit, bIdx) => (
                            <div key={bIdx} className="text-sm">
                                <div className="flex justify-between text-gray-400 text-xs mb-1">
                                    <span>{benefit.name}</span>
                                    <span>{benefit.data_type === 'DATA' ? formatQuota(benefit.remaining) : benefit.remaining}</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div 
                                        className="bg-blue-500 h-2 rounded-full" 
                                        style={{ width: `${(benefit.remaining / benefit.total) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            
            {packages.length === 0 && (
                <div className="col-span-full text-center py-10 text-gray-500">
                    Tidak ada paket aktif.
                </div>
            )}
        </div>

      </main>
    </div>
  );
}
