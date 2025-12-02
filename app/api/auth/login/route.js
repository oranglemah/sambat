import { NextResponse } from 'next/server';
import { sendApiRequest } from '@/lib/xl-client';

export async function POST(request) {
    try {
        const { msisdn, otp } = await request.json();
        
        // PENTING: Kita pakai jalur API v8 MyXL untuk validasi OTP
        const path = "api/v8/auth/otp-login";
        
        const payload = {
            msisdn: msisdn,
            otp: otp,
            is_enterprise: false,
            lang: "en"
        };

        console.log(`[LOGIN] Verifying OTP via v8...`);
        
        // Gunakan sendApiRequest
        const data = await sendApiRequest(path, payload, null, "POST");
        
        // Cek hasil login
        if (data && data.code === "000") {
             // API v8 biasanya mengembalikan data dalam properti 'data'
             // Isinya: access_token, refresh_token, id_token, dll.
             return NextResponse.json({
                status: "SUCCESS",
                data: data.data
             });
        }
        
        return NextResponse.json(data);
    } catch (error) {
        console.error("[LOGIN Error]", error);
        return NextResponse.json({ 
            status: "FAILED", 
            message: error.message || "Gagal Login" 
        }, { status: 500 });
    }
}
