import { NextResponse } from 'next/server';
import { sendApiRequest } from '@/lib/xl-client';

export async function POST(request) {
    try {
        const { id_token } = await request.json();

        // Sesuai fetch_my_packages di package.py
        const path = "api/v8/packages/quota-details";
        const payload = {
            is_enterprise: false,
            lang: "en",
            family_member_id: ""
        };

        const res = await sendApiRequest(path, payload, id_token);
        return NextResponse.json(res.data);
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
