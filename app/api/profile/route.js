import { NextResponse } from 'next/server';
import { sendApiRequest } from '@/lib/xl-client';

export async function POST(request) {
    try {
        const { id_token, access_token } = await request.json();

        // 1. Get Profile (Sesuai get_profile di engsel.py)
        const profileData = await sendApiRequest("api/v8/profile", {
            access_token: access_token,
            app_version: "8.9.0",
            is_enterprise: false,
            lang: "en"
        }, id_token);

        // 2. Get Balance (Sesuai get_balance di engsel.py)
        const balanceData = await sendApiRequest("api/v8/packages/balance-and-credit", {
            is_enterprise: false,
            lang: "en"
        }, id_token);

        return NextResponse.json({
            profile: profileData.data,
            balance: balanceData.data?.balance || {}
        });
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
