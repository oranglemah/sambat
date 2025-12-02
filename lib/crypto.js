import crypto from 'crypto';
import { CONFIG } from './constants';

// --- HELPER BASE64 URL SAFE ---
// Python: urlsafe_b64encode / urlsafe_b64decode
const toBase64Url = (buffer) => {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

const fromBase64Url = (str) => {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
        str += '=';
    }
    return Buffer.from(str, 'base64');
};

// --- HELPER IV DERIVATION ---
// Python: def derive_iv(xtime_ms): ... sha256(str(xtime_ms))[:16]
function deriveIv(xtimeMs) {
    const hash = crypto.createHash('sha256').update(String(xtimeMs)).digest('hex');
    return Buffer.from(hash.substring(0, 16), 'utf-8');
}

// --- ENCRYPT XDATA (AES-CBC) ---
// Python: AES.new(key, AES.MODE_CBC, iv).encrypt(pad(plaintext))
export function encryptXData(plaintext, xtimeMs) {
    try {
        const iv = deriveIv(xtimeMs);
        const key = Buffer.from(CONFIG.XDATA_KEY, 'utf-8');
        
        // Node.js otomatis melakukan PKCS7 padding jika setAutoPadding(true) - default
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(plaintext, 'utf-8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        return toBase64Url(encrypted);
    } catch (e) {
        console.error("Encrypt Error:", e);
        throw e;
    }
}

// --- DECRYPT XDATA ---
// Python: unpad(AES...decrypt(ct))
export function decryptXData(xdata, xtimeMs) {
    try {
        if (!xdata || !xtimeMs) return null;
        
        const iv = deriveIv(xtimeMs);
        const key = Buffer.from(CONFIG.XDATA_KEY, 'utf-8');
        const encryptedBytes = fromBase64Url(xdata);

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedBytes);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf-8');
    } catch (e) {
        console.error("Decrypt Error (Mungkin response plain text):", e.message);
        return xdata; // Kembalikan aslinya jika gagal (kadang error msg plain text)
    }
}

// --- SIGNATURE GENERATORS (HMAC-SHA512) ---

// 1. make_x_signature (General Request)
export function makeXSignature(idToken, method, path, sigTimeSec) {
    // Python: key_str = f"{X_API_BASE_SECRET};{id_token};{method};{path};{sig_time_sec}"
    const keyStr = `${CONFIG.X_API_BASE_SECRET};${idToken};${method};${path};${sigTimeSec}`;
    
    // Python: msg = f"{id_token};{sig_time_sec};"
    const msg = `${idToken};${sigTimeSec};`;

    return crypto.createHmac('sha512', Buffer.from(keyStr, 'utf-8'))
        .update(Buffer.from(msg, 'utf-8'))
        .digest('hex');
}

// 2. make_x_signature_payment (Payment/Settlement)
export function makeXSignaturePayment(accessToken, sigTimeSec, packageCode, tokenPayment, paymentMethod, paymentFor, path) {
    // Hardcoded salt from python file: #ae-hei_9Tee6he+Ik3Gais5=
    // Python: key_str = f"{X_API_BASE_SECRET};{sig_time_sec}#ae-hei_9Tee6he+Ik3Gais5=;POST;{path};{sig_time_sec}"
    const keyStr = `${CONFIG.X_API_BASE_SECRET};${sigTimeSec}#ae-hei_9Tee6he+Ik3Gais5=;POST;${path};${sigTimeSec}`;

    // Python: msg = f"{access_token};{token_payment};{sig_time_sec};{payment_for};{payment_method};{package_code};"
    const msg = `${accessToken};${tokenPayment};${sigTimeSec};${paymentFor};${paymentMethod};${packageCode};`;

    return crypto.createHmac('sha512', Buffer.from(keyStr, 'utf-8'))
        .update(Buffer.from(msg, 'utf-8'))
        .digest('hex');
}

// Helper Time Java-like (Tetap dipakai untuk header x-request-at)
export function javaLikeTimestamp() {
    return new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 17);
}
