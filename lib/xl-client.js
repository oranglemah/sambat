// lib/xl-client.js
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from './constants';
import { encryptSignXData, decryptXData, javaLikeTimestamp } from './crypto';

export async function sendApiRequest(path, payload, idToken = null, method = "POST") {
    // 1. Lakukan Enkripsi & Signing
    const { encrypted_body, x_signature, xtime } = encryptSignXData(
        payload, 
        method, 
        path, 
        idToken
    );

    const sigTimeSec = Math.floor(xtime / 1000);

    // 2. Susun Headers persis seperti engsel.py
    const headers = {
        "Host": CONFIG.BASE_API_URL.replace("https://", ""),
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": CONFIG.UA,
        "x-api-key": CONFIG.API_KEY,
        "x-hv": "v3",
        "x-signature-time": String(sigTimeSec),
        "x-signature": x_signature,
        "x-request-id": uuidv4(),
        "x-request-at": javaLikeTimestamp(),
        "x-version-app": "8.9.0",
    };

    if (idToken) {
        headers["Authorization"] = `Bearer ${idToken}`;
    }

    const url = `${CONFIG.BASE_API_URL}/${path}`;

    try {
        console.log(`[API] ${method} ${path}`);
        
        const response = await axios({
            method: method,
            url: url,
            headers: headers,
            data: encrypted_body, // { "data": "BASE64..." }
            timeout: 30000
        });

        // 3. Dekripsi Response
        // Cek apakah response berupa JSON terenkripsi
        if (response.data && response.data.data && typeof response.data.data === 'string') {
            const decrypted = decryptXData(response.data.data);
            return { ...response.data, data: decrypted }; // Gabungkan status dengan data asli
        } 
        
        // Jika response tidak terenkripsi (misal error text), kembalikan langsung
        return response.data;

    } catch (error) {
        console.error(`[API Error] ${path}:`, error.message);
        
        // Coba dekripsi body error jika ada
        if (error.response?.data?.data) {
            const decryptedErr = decryptXData(error.response.data.data);
            console.error("[Decrypted Error]", decryptedErr);
            throw { ...error, response: { ...error.response, data: decryptedErr } };
        }
        
        throw error.response ? error.response.data : error;
    }
}
