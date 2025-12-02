import { NextResponse } from 'next/server';
import { sendCiamRequest } from '@/lib/xl-client';

export async function POST(request) {
    try {
        const { msisdn } = await request.json();
        
        // PENTING: OTP request ke CIAM v2
        const path = "v2/generateOTP";
        
        const payload = {
            msisdn: msisdn,
            serviceid: "",
            captcha: ""
        };

        const data = await sendCiamRequest(path, payload);
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ status: "FAILED", message: error.message }, { status: 500 });
    }
}
