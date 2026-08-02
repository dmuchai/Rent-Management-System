import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { kcbAdapter } from "../../api/webhooks/banks/_lib/bankAdapter.js";
import { verifyRsaSha256 } from "../../api/webhooks/banks/_lib/handleBankWebhook.js";

const sampleIpn = {
  transactionReference: "FT00026252",
  requestId: "c7d702cb-6b5f-4fa6-8b57-436d0f789017",
  channelCode: "202",
  timestamp: "2026-07-29T09:30:05.000Z",
  transactionAmount: "20,000.00",
  currency: "KES",
  customerReference: "INV-CATHERINE-0826",
  customerName: "Catherine Kamau",
  customerMobileNumber: "254711111111",
  creditAccountIdentifier: "1234567",
  organizationShortCode: "522533",
  tillNumber: "1234567",
};

const documentedTillIpn = {
  header: {
    messageID: "12345",
    originatorConversationID: "TEJ6CQQPBQ",
    channelCode: "202",
    timeStamp: "20250519133100",
  },
  requestPayload: {
    primaryData: {
      businessKey: "1234567",
      businessKeyType: "notifyBiller",
    },
    additionalData: {
      notificationData: {
        businessKey: "INV-CATHERINE-0826",
        businessKeyType: "BillReferenceNumber",
        debitMSISDN: "254711000000",
        transactionAmt: "1000",
        transactionDate: "Mon May 19 13:30:54 EAT 2025",
        transactionID: "FT25139M3RM6",
        firstName: "PETER BOR",
        middleName: "",
        lastName: "",
        currency: "KES",
        narration: "School Fees",
        transactionType: "MPESA",
        balance: "0",
      },
    },
  },
};

test("normalizes a KCB account IPN for channel lookup and reconciliation", () => {
  const payment = kcbAdapter.normalize(sampleIpn);

  assert.equal(payment.transactionId, sampleIpn.transactionReference);
  assert.equal(payment.amount, 20_000);
  assert.equal(payment.currency, "KES");
  assert.equal(payment.payerPhone, "+254711111111");
  assert.equal(payment.payerName, "Catherine Kamau");
  assert.equal(payment.payerAccountRef, "INV-CATHERINE-0826");
  assert.equal(payment.destinationAccount, "1234567");
  assert.equal(payment.destinationPaybill, "522533");
  assert.equal(payment.transactionTime.toISOString(), sampleIpn.timestamp);
});

test("uses tillNumber as the channel identifier when no account identifier is present", () => {
  const { creditAccountIdentifier: _omitted, ...tillIpn } = sampleIpn;
  const payment = kcbAdapter.normalize(tillIpn);

  assert.equal(payment.destinationAccount, "1234567");
});

test("normalizes KCB's documented nested till notification", () => {
  const payment = kcbAdapter.normalize(documentedTillIpn);

  assert.equal(payment.transactionId, "FT25139M3RM6");
  assert.equal(payment.amount, 1_000);
  assert.equal(payment.currency, "KES");
  assert.equal(payment.payerPhone, "+254711000000");
  assert.equal(payment.payerName, "PETER BOR");
  assert.equal(payment.payerAccountRef, "INV-CATHERINE-0826");
  assert.equal(payment.destinationAccount, "1234567");
  assert.equal(payment.transactionTime.toISOString(), "2025-05-19T13:31:00.000Z");
});

test("normalizes KCB's documented 12-digit account timestamp", () => {
  const payment = kcbAdapter.normalize({ ...sampleIpn, timestamp: "202111110305" });

  assert.equal(payment.transactionTime.toISOString(), "2021-11-11T03:05:00.000Z");
});

test("verifies SHA256withRSA signatures and rejects altered payloads", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const payload = JSON.stringify(sampleIpn);
  const signature = sign("RSA-SHA256", Buffer.from(payload), privateKey).toString("base64");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  assert.equal(verifyRsaSha256(payload, signature, publicKeyPem), true);
  assert.equal(
    verifyRsaSha256(payload.replace("20,000.00", "1.00"), signature, publicKeyPem),
    false
  );
});

test("rejects incomplete KCB notifications", () => {
  assert.throws(
    () => kcbAdapter.normalize({ transactionReference: "FT-1" }),
    /Invalid amount/
  );
});
