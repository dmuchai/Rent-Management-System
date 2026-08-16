import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kcbAdapter } from "../../api/webhooks/banks/_lib/bankAdapter.js";
import accountHandler from "../../api/webhooks/banks/kcb/account.js";
import tillHandler from "../../api/webhooks/banks/kcb/till.js";
import validationHandler from "../../api/webhooks/banks/kcb/validation.js";
import {
  buildKcbAccountAck,
  buildKcbTillAck,
  KcbRequestError,
  readAndVerifyKcbPayload,
  resolveKcbAcknowledgementId,
  verifyRsaSha256,
  verifyRsaSha256WithKeys,
} from "../../api/webhooks/banks/_lib/handleBankWebhook.js";
import { buildKcbValidationResponse } from "../../api/webhooks/banks/_lib/kcbValidation.js";

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

function createSignedRequest(body: unknown, privateKey: any): VercelRequest {
  const rawBody = JSON.stringify(body);
  const signature = sign("RSA-SHA256", Buffer.from(rawBody), privateKey).toString("base64");
  const request = Readable.from([Buffer.from(rawBody)]) as unknown as VercelRequest;
  request.headers = { signature };
  request.method = "POST";
  return request;
}

function createMockResponse() {
  const state: { statusCode?: number; body?: any } = {};
  const response = {
    status(code: number) {
      state.statusCode = code;
      return response;
    },
    json(body: any) {
      state.body = body;
      return body;
    },
  } as unknown as VercelResponse;
  return { response, state };
}

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

test("normalizes the 13-digit timestamp in KCB's Account IPN PDF sample", () => {
  const payment = kcbAdapter.normalize({ ...sampleIpn, timestamp: "2021111103005" });

  assert.equal(payment.transactionTime.toISOString(), "2021-11-11T03:00:05.000Z");
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

test("accepts either the current or previous public key during rotation", () => {
  const current = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const previous = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const payload = JSON.stringify(sampleIpn);
  const signature = sign("RSA-SHA256", Buffer.from(payload), previous.privateKey).toString("base64");
  const keys = [current.publicKey, previous.publicKey].map((key) =>
    key.export({ type: "spki", format: "pem" }).toString()
  );

  assert.equal(verifyRsaSha256WithKeys(payload, signature, keys), true);
  assert.equal(verifyRsaSha256WithKeys(`${payload}\n`, signature, keys), false);
});

test("verifies requests with only the authorized previous-key environment value", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const primaryKey = process.env.KCB_WEBHOOK_PUBLIC_KEY;
  const previousKey = process.env.KCB_WEBHOOK_PUBLIC_KEY_PREVIOUS;
  delete process.env.KCB_WEBHOOK_PUBLIC_KEY;
  process.env.KCB_WEBHOOK_PUBLIC_KEY_PREVIOUS = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();

  try {
    const parsed = await readAndVerifyKcbPayload(createSignedRequest(sampleIpn, privateKey));
    assert.deepEqual(parsed, sampleIpn);
  } finally {
    if (primaryKey === undefined) delete process.env.KCB_WEBHOOK_PUBLIC_KEY;
    else process.env.KCB_WEBHOOK_PUBLIC_KEY = primaryKey;
    if (previousKey === undefined) delete process.env.KCB_WEBHOOK_PUBLIC_KEY_PREVIOUS;
    else process.env.KCB_WEBHOOK_PUBLIC_KEY_PREVIOUS = previousKey;
  }
});

test("rejects a missing signature before parsing the payload", async () => {
  const previousKey = process.env.KCB_WEBHOOK_PUBLIC_KEY;
  process.env.KCB_WEBHOOK_PUBLIC_KEY = "not-used-without-a-signature";
  const request = Readable.from([Buffer.from(JSON.stringify(sampleIpn))]) as unknown as VercelRequest;
  request.headers = {};
  request.method = "POST";

  try {
    await assert.rejects(
      () => readAndVerifyKcbPayload(request),
      (error: unknown) => error instanceof KcbRequestError && error.statusCode === 403
    );
  } finally {
    if (previousKey === undefined) delete process.env.KCB_WEBHOOK_PUBLIC_KEY;
    else process.env.KCB_WEBHOOK_PUBLIC_KEY = previousKey;
  }
});

test("verifies the exact raw request bytes before parsing JSON", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const rawBody = JSON.stringify(sampleIpn, null, 2);
  const signature = sign("RSA-SHA256", Buffer.from(rawBody), privateKey).toString("base64");
  const previousKey = process.env.KCB_WEBHOOK_PUBLIC_KEY;
  process.env.KCB_WEBHOOK_PUBLIC_KEY = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();

  const makeRequest = (body: string) => {
    const request = Readable.from([Buffer.from(body)]) as unknown as VercelRequest;
    request.headers = { signature };
    request.method = "POST";
    return request;
  };

  try {
    const parsed = await readAndVerifyKcbPayload(makeRequest(rawBody));
    assert.deepEqual(parsed, sampleIpn);

    await assert.rejects(
      () => readAndVerifyKcbPayload(makeRequest(JSON.stringify(sampleIpn))),
      (error: unknown) => error instanceof KcbRequestError && error.statusCode === 403
    );
  } finally {
    if (previousKey === undefined) {
      delete process.env.KCB_WEBHOOK_PUBLIC_KEY;
    } else {
      process.env.KCB_WEBHOOK_PUBLIC_KEY = previousKey;
    }
  }
});

test("returns Landee-generated transaction IDs in KCB acknowledgements", () => {
  const tillAck = buildKcbTillAck(documentedTillIpn, {
    statusCode: "0",
    statusMessage: "Notification received",
    transactionId: "landee-event-1",
  });
  const accountAck = buildKcbAccountAck(sampleIpn, {
    statusCode: "0",
    statusMessage: "Notification received",
    transactionId: "landee-event-2",
  });

  assert.equal(
    (tillAck.responsePayload as any).transactionInfo.transactionId,
    "landee-event-1"
  );
  assert.equal(accountAck.transactionID, "landee-event-2");
});

test("reuses the original Landee event ID when acknowledging a replay", () => {
  assert.equal(resolveKcbAcknowledgementId(undefined, "existing-event-id"), "existing-event-id");
});

test("builds the mandatory KCB bill-validation response fields", () => {
  assert.deepEqual(buildKcbValidationResponse({
    transactionId: "validation-1",
    statusCode: "0",
    statusMessage: "Success",
    customerName: "Catherine Kamau",
    billAmount: "20000.00",
    currency: "KES",
    billType: "FIXED",
    creditAccountIdentifier: "123456789012",
  }), {
    transactionID: "validation-1",
    statusCode: "0",
    statusMessage: "Success",
    CustomerName: "Catherine Kamau",
    billAmount: "20000.00",
    currency: "KES",
    billType: "FIXED",
    creditAccountIdentifier: "123456789012",
  });
});

test("keeps Till and Account routes contract-specific after valid signature verification", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const previousKey = process.env.KCB_WEBHOOK_PUBLIC_KEY;
  process.env.KCB_WEBHOOK_PUBLIC_KEY = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();

  try {
    const tillResponse = createMockResponse();
    await tillHandler(createSignedRequest(sampleIpn, privateKey), tillResponse.response);
    assert.equal(tillResponse.state.statusCode, 200);
    assert.equal(tillResponse.state.body.header.statusCode, "1");

    const accountResponse = createMockResponse();
    await accountHandler(
      createSignedRequest(documentedTillIpn, privateKey),
      accountResponse.response
    );
    assert.equal(accountResponse.state.statusCode, 200);
    assert.equal(accountResponse.state.body.statusCode, "1");
  } finally {
    if (previousKey === undefined) {
      delete process.env.KCB_WEBHOOK_PUBLIC_KEY;
    } else {
      process.env.KCB_WEBHOOK_PUBLIC_KEY = previousKey;
    }
  }
});

test("returns 405 for non-POST KCB routes", async () => {
  for (const handler of [tillHandler, accountHandler, validationHandler]) {
    const request = Readable.from([]) as unknown as VercelRequest;
    request.headers = {};
    request.method = "GET";
    const mock = createMockResponse();
    await handler(request, mock.response);
    assert.equal(mock.state.statusCode, 405);
  }
});

test("returns 403 for unsigned KCB POST routes", async () => {
  const primaryKey = process.env.KCB_WEBHOOK_PUBLIC_KEY;
  process.env.KCB_WEBHOOK_PUBLIC_KEY = "configured-but-not-read-without-signature";

  try {
    for (const handler of [tillHandler, accountHandler, validationHandler]) {
      const request = Readable.from([Buffer.from(JSON.stringify(sampleIpn))]) as unknown as VercelRequest;
      request.headers = {};
      request.method = "POST";
      const mock = createMockResponse();
      await handler(request, mock.response);
      assert.equal(mock.state.statusCode, 403);
    }
  } finally {
    if (primaryKey === undefined) delete process.env.KCB_WEBHOOK_PUBLIC_KEY;
    else process.env.KCB_WEBHOOK_PUBLIC_KEY = primaryKey;
  }
});

test("accepts a valid signed bill-validation request before configuration checks", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const previousKey = process.env.KCB_WEBHOOK_PUBLIC_KEY;
  const previousOrganizationReference = process.env.KCB_ORGANIZATION_REFERENCE;
  process.env.KCB_WEBHOOK_PUBLIC_KEY = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  delete process.env.KCB_ORGANIZATION_REFERENCE;

  try {
    const mock = createMockResponse();
    await validationHandler(createSignedRequest({
      requestId: "validation-request-1",
      customerReference: "INV-0001",
      organizationReference: "777777",
    }, privateKey), mock.response);

    assert.equal(mock.state.statusCode, 200);
    assert.equal(mock.state.body.statusCode, "1");
    assert.equal(mock.state.body.statusMessage, "KCB organization reference is not configured");
  } finally {
    if (previousKey === undefined) {
      delete process.env.KCB_WEBHOOK_PUBLIC_KEY;
    } else {
      process.env.KCB_WEBHOOK_PUBLIC_KEY = previousKey;
    }
    if (previousOrganizationReference === undefined) {
      delete process.env.KCB_ORGANIZATION_REFERENCE;
    } else {
      process.env.KCB_ORGANIZATION_REFERENCE = previousOrganizationReference;
    }
  }
});

test("rejects incomplete KCB notifications", () => {
  assert.throws(
    () => kcbAdapter.normalize({ transactionReference: "FT-1" }),
    /Invalid amount/
  );
});
