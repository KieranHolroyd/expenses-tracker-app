import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';

export const PASSCODE_LENGTH = 4;
export const PASSCODE_PATTERN = /^\d{4}$/;

/**
 * A four-digit code is only 10,000 possibilities, so the key derivation is
 * deliberately expensive: ~64 MB and ~100 ms per guess. That is unnoticeable
 * when unlocking once, and turns an offline sweep of the whole keyspace into
 * something measured in hours rather than milliseconds. It does not make a
 * short code strong — see the passcode notes in the profile UI.
 */
const KDF = { N: 2 ** 16, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function newSalt() {
	return randomBytes(16).toString('base64');
}

/** The key that actually encrypts rows; it never leaves the process unwrapped. */
export function newDataKey() {
	return randomBytes(KEY_BYTES);
}

function deriveKey(passcode: string, salt: string) {
	return new Promise<Buffer>((resolve, reject) => {
		scrypt(passcode, Buffer.from(salt, 'base64'), KEY_BYTES, KDF, (error, key) =>
			error ? reject(error) : resolve(key)
		);
	});
}

/** `iv || tag || ciphertext`, base64, as a single opaque column value. */
export function encrypt(key: Buffer, plaintext: string) {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

/** Throws if the payload was produced by a different key or has been altered. */
export function decrypt(key: Buffer, payload: string) {
	const bytes = Buffer.from(payload, 'base64');
	if (bytes.length < IV_BYTES + TAG_BYTES) throw new Error('Encrypted value is malformed.');
	const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, IV_BYTES));
	decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
	return Buffer.concat([
		decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)),
		decipher.final()
	]).toString('utf8');
}

/**
 * The passcode wraps a random data key rather than encrypting rows directly, so
 * changing or removing a passcode only rewrites one small column.
 */
export async function wrapDataKey(passcode: string, salt: string, dataKey: Buffer) {
	return encrypt(await deriveKey(passcode, salt), dataKey.toString('base64'));
}

/** The unwrapped data key, or null when the passcode is wrong — GCM tells them apart. */
export async function unwrapDataKey(passcode: string, salt: string, wrapped: string) {
	try {
		const dataKey = Buffer.from(decrypt(await deriveKey(passcode, salt), wrapped), 'base64');
		return dataKey.length === KEY_BYTES ? dataKey : null;
	} catch {
		return null;
	}
}
