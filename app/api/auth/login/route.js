import { NextResponse } from 'next/server';
import { sendCiamRequest } from '@/lib/xl-client';

export async function POST(request) {
    try {
        const { msisdn, otp } = await request.json();
        
        // PENTING: Validate OTP ke CIAM
        const path = "v2/validateOTP";
        
        const payload = {
            msisdn: msisdn,
            otp: otp,
            serviceid: ""
        };

        const data = await sendCiamRequest(path, payload);
        
        // CIAM mengembalikan token langsung, bukan di dalam 'data.data'
        // Format biasanya: { access_token: "...", refresh_token: "..." }
        if (data && data.access_token) {
            return NextResponse.json({
                status: "SUCCESS",
                data: data // Kirim semua balasan CIAM ke frontend
            });
        }
        
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ status: "FAILED", message: error.message }, { status: 500 });
    }
}
