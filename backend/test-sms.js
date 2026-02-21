require('dotenv').config();
const { sendSms } = require('./src/services/termii');

async function testSMS() {
    const phoneNumber = '233244847831'; // Normalized without '+'
    const message = 'Hello from BizNotify! This is a test message to confirm your setup is active.';

    console.log(`Sending SMS to ${phoneNumber}...`);

    try {
        const result = await sendSms(phoneNumber, message);
        console.log('Result:', result);
    } catch (err) {
        console.error('Test script error:', err);
    }
}

testSMS();
