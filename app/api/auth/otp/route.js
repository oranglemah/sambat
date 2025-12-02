import { NextResponse } from 'next/server';
import { sendCiamRequest } from '@/lib/xl-client';

export async function POST(request) {
    try {
        const { msisdn } = await request.json();
        
        // REQUEST OTP KE CIAM
        // Ini endpoint yang benar untuk minta OTP
        const path = "v2/generateOTP";
        
        const payload = {
            msisdn: msisdn,
            serviceid: "",
            captcha: ""
        };

        const data = await sendCiamRequest(path, payload);
        return NextResponse.json(data);
    } catch (error) {
        console.error("OTP Error:", error);
        return NextResponse.json({ status: "FAILED", message: error.message || JSON.stringify(error) }, { status: 500 });
    }
}
