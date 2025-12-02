// app/api/auth/otp/route.js
import { NextResponse } from 'next/server';
import { sendApiRequest } from '@/lib/xl-client';

export async function POST(request) {
    try {
        const { msisdn } = await request.json();
        
        // PERBAIKAN PATH: Gunakan path yang benar untuk request OTP
        const path = "api/v8/auth/otp-request";
        
        // Payload standar untuk request OTP
        const payload = {
            msisdn: msisdn,
            is_enterprise: false,
            lang: "en",
            // Beberapa versi API butuh field tambahan ini, kita tambahkan untuk jaga-jaga
            app_version: "8.9.0", 
            device_id: msisdn // Gunakan nomor sebagai device ID sementara
        };

        console.log(`[API OTP] Requesting OTP for ${msisdn}...`);
        const data = await sendApiRequest(path, payload);
        console.log(`[API OTP] Result:`, JSON.stringify(data));
        
        return NextResponse.json(data);
    } catch (error) {
        console.error(`[API OTP] Error:`, error.message);
        return NextResponse.json({ status: "FAILED", message: error.message, code: error.code || "500" }, { status: 500 });
    }
}
