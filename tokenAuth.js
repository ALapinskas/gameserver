import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicKeyPath = process.env.VALIDATION || path.join(__dirname, 'public.pem');
const PUBLIC_KEY = fs.readFileSync(publicKeyPath, 'utf8');

/**
 * Декодирует строку Base64URL в буфер
 * @param {string} str 
 * @returns {Buffer}
 */
const base64UrlDecode = (str) => {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return Buffer.from(base64, 'base64');
};

/**
 * Валидация EdDSA (Ed25519) токена встроенным модулем crypto
 */
export const verifyToken = (token) => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        console.log(token);
        const [headerB64, payloadB64, signatureB64] = parts;
        const verifyData = Buffer.from(`${headerB64}.${payloadB64}`);
        const signature = base64UrlDecode(signatureB64);

        // Для Ed25519 в Node.js используется прямой метод crypto.verify
        // Ему не нужен объект создания Verifier, он проверяет подпись в один шаг
        const isVerified = crypto.verify(
            null, // Алгоритм null, так как он автоматически определяется типом ключа (Ed25519)
            verifyData,
            PUBLIC_KEY,
            signature
        );
        console.log("is verified: ", isVerified);
        if (!isVerified) return null;

        const payload = JSON.parse(base64UrlDecode(payloadB64).toString());

        // Проверка времени жизни
        if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
            console.log('Токен устарел: ', Math.floor(Date.now() / 1000), " exp: ", payload.exp);
            return null;
        }

        return payload;
    } catch (e) {
        console.error('Ошибка EdDSA валидации:', e.message);
        return null;
    }
};