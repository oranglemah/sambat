import { NextResponse } from 'next/server';
import { sendApiRequest } from '@/lib/xl-client';

export async function POST(request) {
    try {
        const { msisdn, otp } = await request.json();
        // Path sesuai ciam.py -> submit_otp
        const path = "api/v8/auth/otp-login"; // CONTOH PATH, SESUAIKAN
        
        const payload = {
            msisdn: msisdn,
            otp: otp,
            is_enterprise: false,
            lang: "en"
        };

        const data = await sendApiRequest(path, payload);
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ status: "FAILED", message: error.message }, { status: 500 });
    }
}
