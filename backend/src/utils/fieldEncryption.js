import crypto from 'node:crypto';

const getKey = () => {
  const configured = process.env.MEMBER_PII_ENCRYPTION_KEY;
  if (!configured) throw new Error('Member ID encryption is not configured');
  const key = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  if (key.length !== 32) throw new Error('MEMBER_PII_ENCRYPTION_KEY must encode exactly 32 bytes');
  return key;
};

export function encryptField(value) {
  if (!value) return { ciphertext: null, last4: null };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return { ciphertext: `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`, last4: String(value).slice(-4) };
}

export function hashField(value) {
  if (!value) return null;
  return crypto.createHmac('sha256', getKey()).update(String(value).trim().toLowerCase()).digest('hex');
}
