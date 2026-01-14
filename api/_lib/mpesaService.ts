import { createDbConnection } from "./db.js";

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
        this.baseUrl = (process.env.NODE_ENV === "production"
            ? "https://api.safaricom.co.ke"
            : "https://sandbox.safaricom.co.ke").replace(/\/$/, "");

        this.consumerKey = process.env.MPESA_CONSUMER_KEY || "";
        this.consumerSecret = process.env.MPESA_CONSUMER_SECRET || "";
        this.passkey = process.env.MPESA_PASSKEY || "";
        this.shortcode = process.env.MPESA_SHORTCODE || "";
        this.callbackUrl = process.env.MPESA_CALLBACK_URL || "";
    }

    private async getAccessToken(): Promise<string> {
        if (this.tokenCache && this.tokenCache.expiry > Date.now()) {
            return this.tokenCache.token;
        }

        const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString("base64");
        const response = await fetch(`${this.baseUrl}oauth/v1/generate?grant_type=client_credentials`, {
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
        let formattedPhone = phoneNumber.replace(/\+/g, "").replace(/\s/g, "");
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
            AccountReference: accountReference,
            TransactionDesc: transactionDesc,
        };

        const response = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`M-PESA STK Push failed: ${errorData.errorMessage || response.statusText}`);
        }

        return await response.json();
    }

    isConfigured(): boolean {
        return !!(this.consumerKey && this.consumerSecret && this.passkey && this.shortcode && this.callbackUrl);
    }
}

export const mpesaService = new MpesaService();
