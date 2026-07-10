
/**
 * SMS Service for API Functions
 * 
 * Handles sending text messages using Africa's Talking API or Infobip.
 */
import { randomInt } from 'node:crypto';

export interface SmsOptions {
    to: string;
    message: string;
    metadata?: any;
}

export class SmsDeliveryError extends Error {
    constructor(
        message: string,
        public readonly provider: string,
        public readonly providerStatus?: string,
        public readonly providerCode?: string | number,
    ) {
        super(message);
        this.name = 'SmsDeliveryError';
    }
}

export function maskPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 4 ? `***${digits.slice(-4)}` : '***';
}

export class SmsService {
    // AT Credentials
    private atUsername: string | undefined;
    private atApiKey: string | undefined;
    private atSenderId: string | undefined;
    private atApiUrl = 'https://api.africastalking.com/version1/messaging';

    // Infobip Credentials
    private infobipApiKey: string | undefined;
    private infobipBaseUrl: string | undefined;

    constructor() {
        this.atUsername = process.env.AT_USERNAME;
        this.atApiKey = process.env.AT_API_KEY;
        this.atSenderId = process.env.AT_SENDER_ID;

        this.infobipApiKey = process.env.INFOBIP_API_KEY;
        this.infobipBaseUrl = process.env.INFOBIP_BASE_URL;

        // Automatically use sandbox URL if username is 'sandbox'
        if (this.atUsername === 'sandbox') {
            this.atApiUrl = 'https://api.sandbox.africastalking.com/version1/messaging';
        }
    }

    /**
     * Normalizes a Kenyan mobile number to its international MSISDN form.
     * Handles Kenya numbers (country code 254) by default.
     * Examples:
     *   0707213241   → 254707213241
     *   +254707213241 → 254707213241
     *   254707213241  → 254707213241  (unchanged)
     */
    normalizePhoneNumber(phone: string): string {
        const compact = phone.trim().replace(/[\s()-]/g, '');
        const digits = compact.startsWith('+') ? compact.slice(1) : compact;
        const normalized = digits.startsWith('0') ? `254${digits.slice(1)}` : digits;

        if (!/^254(?:7|1)\d{8}$/.test(normalized)) {
            throw new SmsDeliveryError(
                'Enter a valid Kenyan mobile number, for example 0712345678 or +254712345678.',
                'validation',
                'INVALID_PHONE_NUMBER',
            );
        }
        return normalized;
    }

    async sendSms(options: SmsOptions): Promise<any> {
        const provider = process.env.SMS_PROVIDER || 'africastalking';

        // Normalize phone number to international format before sending
        const normalizedTo = this.normalizePhoneNumber(options.to);
        const normalizedOptions = { ...options, to: normalizedTo };

        const maskedTo = maskPhoneNumber(normalizedTo);
        console.info('[SMS] Dispatch requested', { provider, recipient: maskedTo });

        if (provider === 'infobip') {
            return this.sendViaInfobip(normalizedOptions);
        } else {
            return this.sendViaAt({ ...normalizedOptions, to: `+${normalizedTo}` });
        }
    }

    private async sendViaInfobip(options: SmsOptions): Promise<any> {
        if (!this.infobipApiKey || !this.infobipBaseUrl) {
            throw new SmsDeliveryError('SMS delivery is temporarily unavailable.', 'infobip', 'NOT_CONFIGURED');
        }

        let baseUrl = this.infobipBaseUrl.endsWith('/') ? this.infobipBaseUrl.slice(0, -1) : this.infobipBaseUrl;
        if (!baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
        }
        const url = `${baseUrl}/sms/2/text/advanced`;

        const body = {
            messages: [
                {
                    destinations: [{ to: options.to }],
                    from: process.env.INFOBIP_SENDER_ID || 'Landee',
                    text: options.message
                }
            ]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `App ${this.infobipApiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('[SMS] Infobip HTTP rejection', { httpStatus: response.status });
                throw new SmsDeliveryError('The SMS provider rejected the request.', 'infobip', 'HTTP_ERROR', response.status);
            }

            const data = await response.json();
            const messageStatus = data?.messages?.[0]?.status;
            const statusName = messageStatus?.name || 'Unknown';
            const statusDesc = messageStatus?.description || 'No description';

            const accepted = messageStatus?.groupId === 1 || messageStatus?.groupId === 3 ||
                ['PENDING', 'ACCEPTED', 'MESSAGE_ACCEPTED', 'PENDING_ACCEPTED', 'PENDING_ENROUTE', 'DELIVERED_TO_HANDSET'].includes(statusName);
            if (!accepted) {
                console.error('[SMS] Infobip recipient rejected', {
                    recipient: maskPhoneNumber(options.to), status: statusName,
                    code: messageStatus?.id, description: statusDesc,
                });
                throw new SmsDeliveryError('The SMS provider could not accept this phone number.', 'infobip', statusName, messageStatus?.id);
            }
            console.info('[SMS] Infobip accepted message', { recipient: maskPhoneNumber(options.to), status: statusName });
            return data;
        } catch (error) {
            if (!(error instanceof SmsDeliveryError)) console.error('[SMS] Infobip request failed', { error: error instanceof Error ? error.name : 'unknown' });
            throw error;
        }
    }

    private async sendViaAt(options: SmsOptions): Promise<any> {
        if (!this.atUsername || !this.atApiKey) {
            throw new SmsDeliveryError('SMS delivery is temporarily unavailable.', 'africastalking', 'NOT_CONFIGURED');
        }

        const params = new URLSearchParams();
        params.append('username', this.atUsername);
        params.append('to', options.to);
        params.append('message', options.message);
        if (this.atSenderId) {
            params.append('from', this.atSenderId);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(this.atApiUrl, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'apiKey': this.atApiKey,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('[SMS] Africa\'s Talking HTTP rejection', { httpStatus: response.status });
                throw new SmsDeliveryError('The SMS provider rejected the request.', 'africastalking', 'HTTP_ERROR', response.status);
            }

            const data = await response.json();

            // AT returns 201 even if delivery fails for individual recipients
            const recipients = data?.SMSMessageData?.Recipients || [];
            if (recipients.length > 0) {
                const status = recipients[0].status;
                const cost = recipients[0].cost;

                if (status !== 'Success' && status !== 'Sent') {
                    console.error('[SMS] Africa\'s Talking recipient rejected', {
                        recipient: maskPhoneNumber(options.to), status,
                        code: recipients[0].statusCode,
                    });
                    throw new SmsDeliveryError('The SMS provider could not accept this phone number.', 'africastalking', status, recipients[0].statusCode);
                }
                console.info('[SMS] Africa\'s Talking accepted message', { recipient: maskPhoneNumber(options.to), status, cost });
            } else {
                throw new SmsDeliveryError('The SMS provider returned no recipient result.', 'africastalking', 'EMPTY_RECIPIENTS');
            }

            return data;
        } catch (error) {
            if (!(error instanceof SmsDeliveryError)) console.error('[SMS] Africa\'s Talking request failed', { error: error instanceof Error ? error.name : 'unknown' });
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    generateOtp(length: number = 6): string {
        if (!Number.isInteger(length) || length < 1 || length > 9) throw new Error('OTP length must be between 1 and 9');
        const lowerBound = length === 1 ? 0 : 10 ** (length - 1);
        return randomInt(lowerBound, 10 ** length).toString().padStart(length, '0');
    }

    composePaymentConfirmation(
        tenantName: string,
        amount: number,
        propertyName: string,
        unitNumber: string,
        code: string
    ): string {
        const formattedAmount = new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
        }).format(amount);

        return `Dear ${tenantName}, payment of ${formattedAmount} for ${propertyName} Unit ${unitNumber} confirmed. Ref: ${code}. Thank you!`;
    }

    composeRentReminder(
        tenantName: string,
        amount: number,
        dueDate: string,
        propertyName: string
    ): string {
        const formattedAmount = new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
        }).format(amount);

        return `Dear ${tenantName}, your rent of ${formattedAmount} for ${propertyName} is due on ${dueDate}. Please pay promptly to avoid late fees.`;
    }

    composeMaintenanceNotification(
        landlordName: string,
        tenantName: string,
        propertyName: string,
        unitNumber: string,
        title: string,
        priority: string
    ): string {
        return `Dear ${landlordName}, new maintenance request from ${tenantName} (${propertyName} Unit ${unitNumber}): "${title}". Priority: ${priority.toUpperCase()}.`;
    }

    composeLandlordPaymentNotification(
        landlordName: string,
        tenantName: string,
        amount: number,
        propertyName: string,
        unitNumber: string,
        code: string
    ): string {
        const formattedAmount = new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
        }).format(amount);

        return `Dear ${landlordName}, payment of ${formattedAmount} received from ${tenantName} for ${propertyName} Unit ${unitNumber}. Ref: ${code}.`;
    }
}

export const smsService = new SmsService();
