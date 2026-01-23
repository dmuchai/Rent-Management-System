import dotenv from 'dotenv';

dotenv.config();

/**
 * Standalone test script to verify Africa's Talking SMS Credentials
 * Run with: node scripts/test-sms.js
 */

const username = process.env.AT_USERNAME;
const apiKey = process.env.AT_API_KEY;
const senderId = process.env.AT_SENDER_ID;
const testPhone = process.argv[2]; // Get phone from command line argument

async function testSms() {
    if (!username || !apiKey) {
        console.error('❌ Error: AT_USERNAME or AT_API_KEY not found in .env');
        process.exit(1);
    }

    if (!testPhone) {
        console.error('❌ Error: Please provide a phone number to test.');
        console.log('Usage: node scripts/test-sms.js +254XXXXXXXXX');
        process.exit(1);
    }

    console.log(`\n--- SMS Test Configuration ---`);
    console.log(`Username: ${username}`);
    console.log(`API Key:  ${apiKey.substring(0, 8)}...`);
    console.log(`SenderID: ${senderId || 'None (using shared shortcode)'}`);
    console.log(`To:       ${testPhone}`);
    console.log(`------------------------------\n`);

    const apiUrl = username === 'sandbox'
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';

    const params = new URLSearchParams();
    params.append('username', username);
    params.append('to', testPhone);
    params.append('message', 'Hello! This is a test message from your Rent Management System.');

    if (senderId) {
        params.append('from', senderId);
    }

    try {
        console.log(`Sending to ${apiUrl}...`);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'apiKey': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Success! AT API response:');
            console.log(JSON.stringify(data, null, 2));

            const recipientData = data.SMSMessageData?.Recipients?.[0];
            if (recipientData) {
                console.log(`\nStatus for ${recipientData.number}: ${recipientData.status}`);
            }
        } else {
            console.error(`❌ API Failed (${response.status}):`, data);
        }
    } catch (error) {
        console.error('❌ Request failed:', error.message);
    }
}

testSms();
