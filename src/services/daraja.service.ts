import { env } from '../config/env';

const DARAJA_BASE_URL = 'https://sandbox.safaricom.co.ke';

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getDarajaAccessToken(): Promise<string> {
  // Reuse the token if it's still valid (Daraja tokens last 1 hour)
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${env.DARAJA_CONSUMER_KEY}:${env.DARAJA_CONSUMER_SECRET}`
  ).toString('base64');

  const response = await fetch(
    `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${credentials}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Daraja auth failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: string };

  cachedToken = {
    token: data.access_token,
    // Refresh a bit early (55 min) rather than exactly at expiry
    expiresAt: Date.now() + (Number(data.expires_in) - 300) * 1000,
  };

  return cachedToken.token;
}
function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

export async function initiateStkPush(params: {
  phoneNumber: string; // format: 2547XXXXXXXX
  amount: number;
  accountReference: string; // e.g. order id
  transactionDesc: string;
}) {
  const token = await getDarajaAccessToken();
  const timestamp = getTimestamp();
  const password = Buffer.from(
    `${env.DARAJA_SHORTCODE}${env.DARAJA_PASSKEY}${timestamp}`
  ).toString('base64');

  const response = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: env.DARAJA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: params.amount,
      PartyA: params.phoneNumber,
      PartyB: env.DARAJA_SHORTCODE,
      PhoneNumber: params.phoneNumber,
      CallBackURL: env.DARAJA_CALLBACK_URL,
      AccountReference: params.accountReference,
      TransactionDesc: params.transactionDesc,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`STK push failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data; // contains CheckoutRequestID — we'll store this to match against the webhook later
}