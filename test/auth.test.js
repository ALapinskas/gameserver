import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Указываем пути к вашим ранее сгенерированным статическим ключам
const testPrivateKeyPath = path.join(__dirname, '../test_private.pem');
const testPublicKeyPath = path.join(__dirname, '../test_public.pem');

// Проверяем, что файлы физически существуют в папке test/
if (!fs.existsSync(testPrivateKeyPath) || !fs.existsSync(testPublicKeyPath)) {
    throw new Error(
        `Критическая ошибка: Файлы тест-ключей не найдены.\n` +
        `Убедитесь, что они лежат по путям:\n` +
        `- ${testPrivateKeyPath}\n` +
        `- ${testPublicKeyPath}`
    );
}

// Считываем ваш готовый приватный ключ для создания тестовых токенов
const PRIVATE_KEY = fs.readFileSync(testPrivateKeyPath, 'utf8').trim();

/**
 * Вспомогательная функция для сборки JWT (EdDSA)
 * Использует исключительно ваш ранее сгенерированный приватный ключ
 */
const generateTestToken = (payload) => {
    const base64UrlHelper = (buf) => buf.toString('base64')
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .replace(/=/g, '');
    
    const header = { alg: 'EdDSA', typ: 'JWT' };
    const headerB64 = base64UrlHelper(Buffer.from(JSON.stringify(header)));
    const payloadB64 = base64UrlHelper(Buffer.from(JSON.stringify(payload)));
    
    const dataToSign = Buffer.from(`${headerB64}.${payloadB64}`);
    
    // Подписываем данные вашим статическим приватным ключом
    const signature = crypto.sign(null, dataToSign, PRIVATE_KEY);
    
    return `${headerB64}.${payloadB64}.${base64UrlHelper(signature)}`;
};

describe('Тестирование валидации WebSocket токенов через статические тест-ключи', () => {
    let verifyToken, validToken, expiredToken;

    before(async () => {
        // Передаем путь вашего готового публичного ключа в переменную окружения
        process.env.VALIDATION = testPublicKeyPath;

        // Динамически импортируем ваш сервер, чтобы он подхватил process.env.VALIDATION
        const serverModule = await import('../tokenAuth.js');
        verifyToken = serverModule.verifyToken;

        // Генерируем тестовые токены, подписанные вашим ключом
        validToken = generateTestToken({
            username: 'static_test_user',
            exp: Math.floor(Date.now() / 1000) + 3600 // +1 час жизни
        });

        expiredToken = generateTestToken({
            username: 'expired_static_user',
            exp: Math.floor(Date.now() / 1000) - 60 // Просрочен на 1 минуту
        });
    });

    describe('Юнит-тесты валидации', () => {
        it('Должен успешно верифицировать валидный токен', () => {
            const payload = verifyToken(validToken);
            assert.notStrictEqual(payload, null);
            assert.strictEqual(payload.username, 'static_test_user');
        });

        it('Должен вернуть null для просроченного токена', () => {
            const payload = verifyToken(expiredToken);
            assert.strictEqual(payload, null);
        });
    });

    describe('Интеграционные тесты подключения', () => {
        it('Должен разрешить подключение по валидному токену', (done) => {
            console.log("validToken: ", validToken);
            const client = new WebSocket(`ws://localhost:9000/?token=${encodeURIComponent(validToken)}`);
            client.on('open', () => {
                assert.strictEqual(client.readyState, WebSocket.OPEN);
                client.close();
                done();
            });
            client.on('error', (err) => done(err));
        });

        it('Должен вернуть 403 при невалидном токене', (done) => {
            const client = new WebSocket(`ws://localhost:9000/?token=${encodeURIComponent(expiredToken)}`);
            client.on('unexpected-response', (req, res) => {
                assert.strictEqual(res.statusCode, 403);
                done();
            });
        });
    });
});
