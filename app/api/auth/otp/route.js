import { NextResponse } from 'next/server';
import { sendApiRequest } from '@/lib/xl-client';

export async function POST(request) {
    try {
        const { msisdn } = await request.json();
        
        // PENTING: Kita pakai jalur API v8 MyXL (bukan CIAM)
        // Jalur ini menggunakan enkripsi xdata, jadi lebih dipercaya server
        const path = "api/v8/auth/otp-request";
        
        const payload = {
            msisdn: msisdn,
            is_enterprise: false,
            lang: "en"
        };

        console.log(`[OTP] Requesting via v8 for ${msisdn}...`);
        
        // Gunakan sendApiRequest (bukan sendCiamRequest)
        // Parameter ke-3 (idToken) null karena belum login
        const data = await sendApiRequest(path, payload, null, "POST");
        
        return NextResponse.json(data);
    } catch (error) {
        console.error("[OTP Error]", error);
        return NextResponse.json({ 
            status: "FAILED", 
            message: error.message || "Gagal request OTP" 
        }, { status: 500 });
    }
}
