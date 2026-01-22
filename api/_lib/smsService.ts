
/**
 * SMS Service for API Functions
 * 
 * Handles sending text messages using Africa's Talking API.
 */

export interface SmsOptions {
    to: string;
    message: string;
    metadata?: any;
}

export class SmsService {
    private username: string | undefined;
    private apiKey: string | undefined;
    private senderId: string | undefined;
    private apiUrl = 'https://api.africastalking.com/version1/messaging';

    constructor() {
        this.username = process.env.AT_USERNAME;
        this.apiKey = process.env.AT_API_KEY;
        this.senderId = process.env.AT_SENDER_ID;
    }

    async sendSms(options: SmsOptions): Promise<any> {
        if (!this.username || !this.apiKey) {
            console.warn('[SMS] Africa\'s Talking credentials not configured. SMS will be logged to console only.');
            console.log(`[SMS MOCK] To: ${options.to} | Message: ${options.message}`);
            return { status: 'mocked', message: 'SMS credentials missing' };
        }

        const params = new URLSearchParams();
        params.append('username', this.username);
        params.append('to', options.to);
        params.append('message', options.message);
        if (this.senderId) {
            params.append('from', this.senderId);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'apiKey': this.apiKey,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('[SMS] AT API error:', errorData);
                throw new Error(`AT API failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ SMS sent successfully to:', options.to);
            return data;
        } catch (error) {
            console.error('[SMS] Send failed:', error);
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    generateOtp(length: number = 6): string {
        return Math.floor(100000 + Math.random() * 900000).toString().substring(0, length);
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
