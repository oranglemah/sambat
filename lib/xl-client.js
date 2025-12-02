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

// --- FUNGSI REQUEST KE CIAM (LOGIN/OTP) ---
// Ini fungsi baru untuk menangani OTP sesuai repo asli
export async function sendCiamRequest(path, payload, method = "POST") {
    const url = `${CONFIG.BASE_CIAM_URL}/${path}`;
    
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Basic ${CONFIG.BASIC_AUTH}`, // Pakai Basic Auth dari constants
        "User-Agent": CONFIG.UA
    };

    try {
        console.log(`[CIAM] ${method} ${path}`);
        const response = await axios({
            method: method,
            url: url,
            headers: headers,
            data: payload,
            timeout: 30000
        });
        return response.data;
    } catch (error) {
        console.error(`[CIAM Error]`, error.response?.data || error.message);
        throw error.response ? error.response.data : error;
    }
}

// --- FUNGSI REQUEST KE MYXL (DATA/PAKET) ---
export async function sendApiRequest(path, payload, idToken = null, method = "POST") {
    const xtime = Date.now();
    const sigTimeSec = Math.floor(xtime / 1000);

    const plainBody = JSON.stringify(payload);
    const xdataEncrypted = encryptXData(plainBody, xtime);

    const requestBody = { xdata: xdataEncrypted, xtime: xtime };

    let xSignature = "";
    if (idToken) {
        xSignature = makeXSignature(idToken, method, path, sigTimeSec);
    }

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
            data: requestBody,
            timeout: 30000
        });

        const resData = response.data;
        if (resData && resData.xdata && resData.xtime) {
            const decryptedString = decryptXData(resData.xdata, resData.xtime);
            return JSON.parse(decryptedString);
        }
        return resData;
    } catch (error) {
        if (error.response?.data?.xdata) {
            const errData = error.response.data;
            const decryptedErr = decryptXData(errData.xdata, errData.xtime);
            throw JSON.parse(decryptedErr);
        }
        throw error.response ? error.response.data : error;
    }
}

// --- FUNGSI CARI PAKET ---
export async function findPackageDetail(familyCode, variantCode, order, idToken) {
    const familyRes = await sendApiRequest("api/v8/xl-stores/options/list", {
        package_family_code: familyCode,
        is_enterprise: false, migration_type: "NONE", lang: "en"
    }, idToken);

    if (familyRes.status !== 'SUCCESS') return null;

    const variants = familyRes.data.package_variants;
    for (let v of variants) {
        if (v.package_variant_code === variantCode || v.name === variantCode) {
            for (let opt of v.package_options) {
                if (opt.order === order) {
                     const detailRes = await sendApiRequest("api/v8/xl-stores/options/detail", {
                        package_option_code: opt.package_option_code, lang: "en"
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
    
    const mainItem = items[token_confirmation_idx || 0];
    const paymentTarget = mainItem.item_code;
    const finalAmount = (overwrite_amount !== undefined && overwrite_amount !== -1) 
        ? overwrite_amount 
        : items.reduce((acc, curr) => acc + curr.item_price, 0);

    // 1. Intercept
    await sendApiRequest("misc/api/v8/utility/intercept-page", {
        is_enterprise: false, lang: "en", package_option_code: items[0].item_code
    }, id_token);

    // 2. Get Payment Method
    const payMethodRes = await sendApiRequest("payments/api/v8/payment-methods-option", {
        payment_type: "PURCHASE", is_enterprise: false, payment_target: paymentTarget,
        lang: "en", is_referral: false, token_confirmation: mainItem.token_confirmation
    }, id_token);

    if (payMethodRes.status !== 'SUCCESS') throw new Error("Gagal Payment Method");

    const tokenPayment = payMethodRes.data.token_payment;
    const tsToSign = payMethodRes.data.timestamp;

    // 3. Payload
    const itemsPayload = items.map(i => ({
        item_code: i.item_code, product_type: "", item_price: i.item_price,
        item_name: i.item_name, tax: 0, token_confirmation: i.token_confirmation
    }));

    const path = "payments/api/v8/settlement-multipayment";
    const settlementPayload = {
        total_discount: 0, is_enterprise: false, token_payment: tokenPayment,
        is_myxl_wallet: false, payment_method: "BALANCE",
        timestamp: Math.floor(Date.now() / 1000), payment_for: payment_for || "BUY_PACKAGE",
        access_token: access_token, total_amount: finalAmount, items: itemsPayload,
        lang: "en", members: [], akrab_members: [], additional_data: {
            original_price: items[items.length-1].item_price, balance_type: "PREPAID_BALANCE"
        }
    };

    // 4. Encrypt & Sign
    const reqXtime = Date.now();
    const reqPlainBody = JSON.stringify(settlementPayload);
    const reqXdata = encryptXData(reqPlainBody, reqXtime);
    const sigTimeSec = Math.floor(tsToSign / 1000); 
    
    const paymentSignature = makeXSignaturePayment(
        access_token, sigTimeSec, paymentTarget, tokenPayment,
        "BALANCE", payment_for || "BUY_PACKAGE", path
    );

    const headers = {
        "Host": CONFIG.BASE_API_URL.replace("https://", ""),
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": CONFIG.UA,
        "x-api-key": CONFIG.API_KEY,
        "Authorization": `Bearer ${id_token}`,
        "x-hv": "v3",
        "x-signature-time": String(sigTimeSec),
        "x-signature": paymentSignature,
        "x-request-id": uuidv4(),
        "x-request-at": javaLikeTimestamp(),
        "x-version-app": "8.9.0",
    };

    const url = `${CONFIG.BASE_API_URL}/${path}`;
    
    try {
        console.log(`[SETTLEMENT] Rp${finalAmount}`);
        const response = await axios.post(url, { xdata: reqXdata, xtime: reqXtime }, { headers });
        if (response.data && response.data.xdata) {
            return JSON.parse(decryptXData(response.data.xdata, response.data.xtime));
        }
        return response.data;
    } catch (error) {
        if (error.response?.data?.xdata) {
            throw JSON.parse(decryptXData(error.response.data.xdata, error.response.data.xtime));
        }
        throw error.response ? error.response.data : error;
    }
}
