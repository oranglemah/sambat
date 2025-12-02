import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from './constants';
import { 
    encryptXData, 
    decryptXData, 
    makeXSignature, 
    makeXSignaturePayment, 
    javaLikeTimestamp 
} from './crypto';

// --- MAIN REQUEST FUNCTION ---
export async function sendApiRequest(path, payload, idToken = null, method = "POST") {
    const xtime = Date.now(); // milliseconds
    const sigTimeSec = Math.floor(xtime / 1000); // seconds

    // 1. Encrypt Body (AES-CBC Custom IV)
    // Python: plain_body -> json dumps -> encrypt_xdata
    const plainBody = JSON.stringify(payload); // Node.js JSON.stringify mirip json.dumps separators default
    const xdataEncrypted = encryptXData(plainBody, xtime);

    // Format Body Request
    const requestBody = {
        xdata: xdataEncrypted,
        xtime: xtime
    };

    // 2. Generate Signature (General)
    let xSignature = "";
    if (idToken) {
        xSignature = makeXSignature(idToken, method, path, sigTimeSec);
    }

    // 3. Headers
    const headers = {
        "Host": CONFIG.BASE_API_URL.replace("https://", ""),
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": CONFIG.UA,
        "x-api-key": CONFIG.API_KEY,
        "x-hv": "v3",
        "x-signature-time": String(sigTimeSec),
        "x-signature": xSignature,
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
            data: requestBody, // Body { xdata: ..., xtime: ... }
            timeout: 30000
        });

        // 4. Decrypt Response
        const resData = response.data;
        if (resData && resData.xdata && resData.xtime) {
            const decryptedString = decryptXData(resData.xdata, resData.xtime);
            return JSON.parse(decryptedString);
        }
        
        return resData;

    } catch (error) {
        // Handle Error Response Decryption
        if (error.response?.data?.xdata) {
            const errData = error.response.data;
            const decryptedErr = decryptXData(errData.xdata, errData.xtime);
            console.error(`[API Error Decrypted]`, decryptedErr);
            throw JSON.parse(decryptedErr);
        }
        throw error.response ? error.response.data : error;
    }
}

// --- FUNGSI CARI PAKET ---
export async function findPackageDetail(familyCode, variantCode, order, idToken) {
    // 1. Get Family (Recursive check jika perlu, tapi langsung list dulu)
    const familyRes = await sendApiRequest("api/v8/xl-stores/options/list", {
        package_family_code: familyCode,
        is_enterprise: false,
        migration_type: "NONE",
        lang: "en"
    }, idToken);

    if (familyRes.status !== 'SUCCESS') return null;

    // 2. Filter
    const variants = familyRes.data.package_variants;
    for (let v of variants) {
        if (v.package_variant_code === variantCode || v.name === variantCode) {
            for (let opt of v.package_options) {
                if (opt.order === order) {
                     // 3. Detail
                     const detailRes = await sendApiRequest("api/v8/xl-stores/options/detail", {
                        package_option_code: opt.package_option_code,
                        lang: "en"
                     }, idToken);
                     return detailRes.data;
                }
            }
        }
    }
    return null;
}

// --- FUNGSI SETTLEMENT (PEMBELIAN) ---
export async function settlementBalanceComplex(tokens, params) {
    const { items, payment_for, overwrite_amount, token_confirmation_idx } = params;
    const { id_token, access_token } = tokens;
    
    // Setup Item & Amount
    const mainItem = items[token_confirmation_idx || 0];
    const paymentTarget = mainItem.item_code;
    const finalAmount = (overwrite_amount !== undefined && overwrite_amount !== -1) 
        ? overwrite_amount 
        : items.reduce((acc, curr) => acc + curr.item_price, 0);

    // 1. Intercept
    await sendApiRequest("misc/api/v8/utility/intercept-page", {
        is_enterprise: false, lang: "en", package_option_code: items[0].item_code
    }, id_token);

    // 2. Get Payment Method (Dapat Token Payment)
    const payMethodRes = await sendApiRequest("payments/api/v8/payment-methods-option", {
        payment_type: "PURCHASE",
        is_enterprise: false,
        payment_target: paymentTarget,
        lang: "en",
        is_referral: false,
        token_confirmation: mainItem.token_confirmation
    }, id_token);

    if (payMethodRes.status !== 'SUCCESS') throw new Error("Gagal Payment Method");

    const tokenPayment = payMethodRes.data.token_payment;
    const tsToSign = payMethodRes.data.timestamp; // Timestamp dari server untuk signature

    // 3. Payload Settlement
    const itemsPayload = items.map(i => ({
        item_code: i.item_code,
        product_type: "",
        item_price: i.item_price,
        item_name: i.item_name,
        tax: 0,
        token_confirmation: i.token_confirmation
    }));

    const path = "payments/api/v8/settlement-multipayment";
    const settlementPayload = {
        total_discount: 0,
        is_enterprise: false,
        token_payment: tokenPayment,
        is_myxl_wallet: false,
        payment_method: "BALANCE",
        timestamp: Math.floor(Date.now() / 1000), // Request TS
        payment_for: payment_for || "BUY_PACKAGE",
        access_token: access_token,
        total_amount: finalAmount,
        items: itemsPayload,
        lang: "en",
        members: [],
        akrab_members: [],
        additional_data: {
            original_price: items[items.length-1].item_price,
            balance_type: "PREPAID_BALANCE"
        }
    };

    // 4. Encrypt Body (Request Biasa)
    const reqXtime = Date.now();
    const reqPlainBody = JSON.stringify(settlementPayload);
    const reqXdata = encryptXData(reqPlainBody, reqXtime);

    // 5. Generate SPECIAL PAYMENT SIGNATURE
    // PENTING: Gunakan 'tsToSign' (dari server) bukan 'reqXtime' (lokal) untuk signature
    const sigTimeSec = Math.floor(tsToSign / 1000); 
    
    const paymentSignature = makeXSignaturePayment(
        access_token,
        sigTimeSec,
        paymentTarget,
        tokenPayment,
        "BALANCE",
        payment_for || "BUY_PACKAGE",
        path
    );

    // 6. Headers Manual (Override x-signature)
    const headers = {
        "Host": CONFIG.BASE_API_URL.replace("https://", ""),
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": CONFIG.UA,
        "x-api-key": CONFIG.API_KEY,
        "Authorization": `Bearer ${id_token}`,
        "x-hv": "v3",
        "x-signature-time": String(sigTimeSec), // Gunakan TS Server
        "x-signature": paymentSignature,        // Gunakan Signature Payment
        "x-request-id": uuidv4(),
        "x-request-at": javaLikeTimestamp(),
        "x-version-app": "8.9.0",
    };

    const url = `${CONFIG.BASE_API_URL}/${path}`;
    const requestBody = { xdata: reqXdata, xtime: reqXtime };

    try {
        console.log(`[SETTLEMENT] Rp${finalAmount}`);
        const response = await axios.post(url, requestBody, { headers });
        
        const resData = response.data;
        if (resData && resData.xdata) {
            const dec = decryptXData(resData.xdata, resData.xtime);
            return JSON.parse(dec);
        }
        return resData;
    } catch (error) {
        if (error.response?.data?.xdata) {
            const dec = decryptXData(error.response.data.xdata, error.response.data.xtime);
            throw JSON.parse(dec);
        }
        throw error.response ? error.response.data : error;
    }
}
