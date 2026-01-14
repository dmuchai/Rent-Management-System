import { storage } from "../storage";

interface MpesaAuthResponse {
    access_token: string;
    expires_in: string;
}

interface StkPushResponse {
    MerchantRequestID: string;
    CheckoutRequestID: string;
    ResponseCode: string;
    ResponseDescription: string;
    CustomerMessage: string;
}

export class MpesaService {
    private baseUrl: string;
    private consumerKey: string;
    private consumerSecret: string;
    private passkey: string;
    private shortcode: string;
    private callbackUrl: string;
    private tokenCache: { token: string; expiry: number } | null = null;

    constructor() {
        const env = process.env.MPESA_ENV || "sandbox";
        this.baseUrl = (env === "production"
            ? "https://api.safaricom.co.ke"
            : "https://sandbox.safaricom.co.ke").replace(/\/$/, "");

        this.consumerKey = (process.env.MPESA_CONSUMER_KEY || "").trim();
        this.consumerSecret = (process.env.MPESA_CONSUMER_SECRET || "").trim();
        this.passkey = (process.env.MPESA_PASSKEY || "").trim();
        this.shortcode = (process.env.MPESA_SHORTCODE || "").trim();
        this.callbackUrl = (process.env.MPESA_CALLBACK_URL || "").trim();
    }

    private async getAccessToken(): Promise<string> {
        if (this.tokenCache && this.tokenCache.expiry > Date.now()) {
            return this.tokenCache.token;
        }

        const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString("base64");
        const tokenUrl = `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`;

        console.log(`[M-PESA Debug] Fetching token from: ${tokenUrl}`);
        console.log(`[M-PESA Debug] Auth Header: Basic ${auth.slice(0, 10)}...`);

        const response = await fetch(tokenUrl, {
            headers: {
                Authorization: `Basic ${auth}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[M-PESA Error] Token generation failed (${response.status}):`, errorText);
            throw new Error(`Failed to get M-PESA access token: ${response.status} ${response.statusText}`);
        }

        const data: MpesaAuthResponse = await response.json();
        console.log(`[M-PESA Debug] Token received. Expires in: ${data.expires_in}s`);

        this.tokenCache = {
            token: data.access_token,
            expiry: Date.now() + (parseInt(data.expires_in) - 60) * 1000,
        };

        return data.access_token;
    }

    async initiateStkPush(phoneNumber: string, amount: number, accountReference: string, transactionDesc: string): Promise<StkPushResponse> {
        const token = await this.getAccessToken();
        const timestamp = new Date(new Date().getTime() + (3 * 60 * 60 * 1000)).toISOString().replace(/[-:T.Z]/g, "").slice(0, 14); // EAT (GMT+3)
        const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString("base64");

        // Format phone number to 254XXXXXXXXX
        let formattedPhone = phoneNumber.replace(/\+/g, "");
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "254" + formattedPhone.slice(1);
        } else if (formattedPhone.startsWith("7") || formattedPhone.startsWith("1")) {
            formattedPhone = "254" + formattedPhone;
        }

        const payload = {
            BusinessShortCode: this.shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.round(amount),
            PartyA: formattedPhone,
            PartyB: this.shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: this.callbackUrl,
            AccountReference: accountReference.slice(0, 12), // Safaricom limit is 12 characters
            TransactionDesc: transactionDesc.slice(0, 20), // Safaricom limit is 20 characters
        };

        const pushUrl = `${this.baseUrl}/mpesa/stkpush/v1/processrequest`;
        console.log(`[M-PESA Debug] Initiating STK Push to: ${pushUrl}`);
        console.log(`[M-PESA Debug] Payload:`, JSON.stringify({ ...payload, Password: '***' }));

        const response = await fetch(pushUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.errorMessage || response.statusText;
            console.error(`[M-PESA Error] STK Push failed (${response.status}):`, errorMsg, JSON.stringify(errorData));

            // If token is invalid, clear cache so next retry gets a fresh one
            if (response.status === 401 || errorMsg.includes("Invalid Access Token")) {
                console.warn("[M-PESA Debug] Clearing token cache due to auth failure");
                this.tokenCache = null;
            }

            throw new Error(`M-PESA STK Push failed: ${errorMsg}`);
        }

        return await response.json();
    }

    isConfigured(): boolean {
        return !!(this.consumerKey && this.consumerSecret && this.passkey && this.shortcode && this.callbackUrl);
    }
}

export const mpesaService = new MpesaService();
