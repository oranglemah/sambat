import { NextResponse } from 'next/server';
import { sendCiamRequest, sendApiRequest } from '@/lib/xl-client';

export async function POST(request) {
    try {
        const { msisdn, otp } = await request.json();
        
        // TAHAP 1: Validate OTP ke CIAM
        // Mendapatkan access_token sementara
        console.log("Step 1: Validating OTP with CIAM...");
        const ciamPath = "v2/validateOTP";
        const ciamPayload = {
            msisdn: msisdn,
            otp: otp,
            serviceid: ""
        };

        const ciamData = await sendCiamRequest(ciamPath, ciamPayload);
        
        // Jika gagal di CIAM
        if (!ciamData || !ciamData.access_token) {
            throw new Error("Gagal validasi OTP di CIAM: " + JSON.stringify(ciamData));
        }

        // TAHAP 2: Tukar Token ke MyXL (API v8)
        // Menukarkan access_token CIAM dengan id_token MyXL
        console.log("Step 2: Exchanging token with MyXL API...");
        const apiPath = "api/v8/auth/login";
        const apiPayload = {
            access_token: ciamData.access_token, // Token dari tahap 1
            is_enterprise: false,
            lang: "en"
        };
        
        // Request ke API v8 (Login)
        // Token belum ada (null), karena kita sedang mau login
        const apiData = await sendApiRequest(apiPath, apiPayload, null, "POST");

        if (apiData && apiData.code === "000") {
            // BERHASIL! Gabungkan data penting
            // Kita butuh 'id_token' untuk request selanjutnya
            // Kita butuh 'access_token' (yang baru dari API, bukan CIAM) untuk signature
            return NextResponse.json({
                status: "SUCCESS",
                data: apiData.data // Berisi id_token, access_token, refresh_token
            });
        } else {
            throw new Error("Gagal tukar token di MyXL: " + JSON.stringify(apiData));
        }

    } catch (error) {
        console.error("Login Error:", error);
        return NextResponse.json({ status: "FAILED", message: error.message || "Gagal Login" }, { status: 500 });
    }
}
