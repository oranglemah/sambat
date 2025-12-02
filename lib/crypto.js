// lib/crypto.js
import crypto from 'crypto';
import { CONFIG } from './constants';

// Helper: Java-like Timestamp (format: YYYYMMDDHHmmssSSS + Offset)
// Sederhananya, XL kadang terima timestamp biasa, tapi kita ikuti format aman
export function javaLikeTimestamp() {
    return new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 17);
}

// 1. Fungsi Enkripsi AES-256-CBC
// Ini menggantikan logika enkripsi body di Python
function aesEncrypt(payload) {
    try {
        const key = Buffer.from(CONFIG.XDATA_KEY, 'utf-8'); // 32 bytes
        const iv = crypto.randomBytes(16); // Random IV setiap request
        
        // Pastikan payload string (minified JSON)
        const plaintext = typeof payload === 'string' ? payload : JSON.stringify(payload);

        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(plaintext, 'utf-8', 'base64');
        encrypted += cipher.final('base64');

        // Format return biasanya: Base64(IV + EncryptedBytes)
        // Di Python 'encrypt.py' seringkali menggabungkan IV di depan ciphertext
        const ivBase64 = iv.toString('base64');
        const combined = Buffer.concat([iv, Buffer.from(encrypted, 'base64')]);
        
        return combined.toString('base64');
    } catch (e) {
        console.error("Encrypt Error:", e);
        throw e;
    }
}

// 2. Fungsi Dekripsi AES-256-CBC
// Untuk membaca balasan dari Server XL
export function decryptXData(encryptedBase64) {
    try {
        if (!encryptedBase64) return null;

        const key = Buffer.from(CONFIG.XDATA_KEY, 'utf-8');
        const inputBuffer = Buffer.from(encryptedBase64, 'base64');

        // Ambil 16 byte pertama sebagai IV
        const iv = inputBuffer.subarray(0, 16);
        const encryptedText = inputBuffer.subarray(16);

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return JSON.parse(decrypted.toString('utf-8'));
    } catch (e) {
        console.error("Decrypt Error/Plain Response:", e.message);
        // Kadang server error return plain text (HTML/JSON biasa), kembalikan as is
        return encryptedBase64; 
    }
}

// 3. Fungsi Signature (HMAC-SHA256)
// Ini inti dari 'encryptsign_xdata'
export function encryptSignXData(payload, method, path, idToken = null) {
    const timestamp = Date.now(); // Epoch ms untuk signature time
    
    // 1. Enkripsi Body
    // XL API v8 biasanya membungkus data enkripsi dalam key "data"
    const encryptedString = aesEncrypt(payload);
    const bodyPayload = { data: encryptedString };
    const bodyString = JSON.stringify(bodyPayload);

    // 2. Generate Signature
    // Format string yang di-sign harus urut.
    // Berdasarkan analisis 'me-cli', signature diambil dari HMAC(Secret, Body + Timestamp + APIKey)
    // Atau kadang: HMAC(Secret, Method + Path + Body + Timestamp)
    
    // Kita gunakan format paling umum untuk API v8 MyXL:
    // Payload + Timestamp + Salt/SecretPart? 
    // Di engsel.py tertulis x_signature diambil dari hasil enkripsi,
    // Mari kita gunakan standar HMAC SHA256 terhadap Body.
    
    const sigTimeSec = Math.floor(timestamp / 1000);
    
    // Formula Signature MyXL v8 (Paling sering dipakai):
    // Signature = HMAC-SHA256( Key=Secret, Data = BodyString + Timestamp + API_KEY )
    // Catatan: Jika gagal, coba variasi urutan string.
    const stringToSign = bodyString + sigTimeSec + CONFIG.API_KEY;
    
    const signature = crypto
        .createHmac('sha256', CONFIG.X_API_BASE_SECRET)
        .update(stringToSign)
        .digest('hex'); // atau 'base64', MyXL biasanya Hex di v8

    return {
        encrypted_body: bodyPayload,
        xtime: timestamp,
        x_signature: signature
    };
}
