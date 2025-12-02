import { NextResponse } from 'next/server';
import { sendApiRequest } from '@/lib/xl-client';

export async function POST(request) {
    try {
        const { msisdn } = await request.json();
        // Endpoint ambil dari logic get_otp Python (biasanya login/request-otp atau init)
        // Cek file app/client/ciam.py di repo asli untuk path pastinya
        const path = "api/v8/auth/otp-request"; // CONTOH PATH, SESUAIKAN
        
        const payload = {
            msisdn: msisdn,
            is_enterprise: false,
            lang: "en"
        };

        const data = await sendApiRequest(path, payload);
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ status: "FAILED", message: error.message }, { status: 500 });
    }
}
