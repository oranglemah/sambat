// lib/xl-client.js
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { encryptPayload, decryptResponse, getJavaLikeTimestamp } from './crypto';

const BASE_API_URL = "https://api.myxl.xlaxiata.co.id"; // Sesuaikan env
const API_KEY = "YOUR_ANDROID_API_KEY_HERE"; // Ambil dari script Python Anda
const UA = "YOUR_USER_AGENT"; // Ambil dari script Python Anda

export async function sendApiRequest(path, payload, idToken = null, method = "POST") {
    // 1. Enkripsi Payload (Sesuai Python: encryptsign_xdata)
    const { encrypted_body, x_signature, xtime } = encryptPayload({
        ...payload,
        method: method,
        path: path,
        id_token: idToken
    });

    const now = new Date();
    const sigTimeSec = Math.floor(xtime / 1000);

    // 2. Setup Headers (Sesuai Python: send_api_request)
    const headers = {
        "host": "api.myxl.xlaxiata.co.id",
        "content-type": "application/json; charset=utf-8",
        "user-agent": UA,
        "x-api-key": API_KEY,
        "x-hv": "v3",
        "x-signature-time": String(sigTimeSec),
        "x-signature": x_signature,
        "x-request-id": uuidv4(),
        "x-request-at": getJavaLikeTimestamp(), // Format Java timestamp
        "x-version-app": "8.9.0", // Sesuai script Python
    };

    if (idToken) {
        headers["authorization"] = `Bearer ${idToken}`;
    }

    const url = `${BASE_API_URL}/${path}`;

    try {
        console.log(`[XL-API] Requesting ${path}...`);
        const response = await axios({
            method: method,
            url: url,
            headers: headers,
            data: encrypted_body, // Kirim body terenkripsi
            timeout: 30000
        });

        // 3. Decrypt Response (Sesuai Python: decrypt_xdata)
        const decryptedData = decryptResponse(response.data);
        return decryptedData;

    } catch (error) {
        console.error("[XL-API Error]", error.response?.data || error.message);
        // Jika error dari server XL seringkali perlu didekripsi juga
        if (error.response?.data) {
             return decryptResponse(error.response.data);
        }
        throw error;
    }
}
