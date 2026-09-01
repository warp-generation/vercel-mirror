const fetch = require('node-fetch');
const crypto = require('crypto');

// Генерация ключей ECDSA P-256 (secp256r1) с использованием встроенного модуля crypto
function generateMasqueKeys() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1', // P-256 / secp256r1
        publicKeyEncoding: {
            type: 'spki',
            format: 'der'
        },
        privateKeyEncoding: {
            type: 'sec1',
            format: 'der'
        }
    });

    return {
        privKeySec1: privateKey.toString('base64'),
        pubKeySpki: publicKey.toString('base64')
    };
}

// Вспомогательные функции для генерации случайных данных
function randomBase64(len) {
    return crypto.randomBytes(len).toString('base64');
}

function randomHex(len) {
    return crypto.randomBytes(len).toString('hex');
}

async function apiRequest(method, endpoint, body = null, token = null) {
    // Используем заголовки и версию API из воркера для лучшей совместимости с MASQUE
    const headers = {
        'User-Agent': 'WARP for Android',
        'CF-Client-Version': 'a-6.35-4471',
        'Content-Type': 'application/json; charset=UTF-8',
        'Connection': 'Keep-Alive',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`https://api.cloudflareclient.com/v0a4471/${endpoint}`, options);
    
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
    }
    
    return response.json();
}

async function getMSQData() {
    try {
        // 1. Первичная регистрация (API Cloudflare требует сначала регнуть curve25519)
        const regBody = {
            key: randomBase64(32),
            install_id: '',
            fcm_token: '',
            tos: new Date().toISOString().replace('Z', '+00:00'),
            model: 'PC',
            serial_number: randomHex(8),
            os_version: '',
            key_type: 'curve25519',
            tunnel_type: 'wireguard',
            locale: 'en_US',
        };
        
        const regResponse = await apiRequest('POST', 'reg', regBody);
        
        // В зависимости от версии API, данные могут быть в корне или в объекте 'result'
        const account = regResponse.result || regResponse;

        if (!account || !account.id || !account.token) {
            throw new Error('Failed to register device: ' + JSON.stringify(account).slice(0, 300));
        }

        const id = account.id;
        const token = account.token;

        // 2. Генерируем ключи для MASQUE
        const { privKeySec1, pubKeySpki } = generateMasqueKeys();

        // 3. Отправляем PATCH запрос для переключения на MASQUE (secp256r1)
        const patchBody = {
            key: pubKeySpki,
            key_type: 'secp256r1',
            tunnel_type: 'masque',
            name: 'usque-vercel',
        };

        const warpResponse = await apiRequest('PATCH', `reg/${id}`, patchBody, token);
        const enrolled = warpResponse.result || warpResponse;

        if (!enrolled.config || !enrolled.config.peers || !enrolled.config.interface) {
            throw new Error('Failed to enable MASQUE: ' + JSON.stringify(enrolled).slice(0, 300));
        }

        const peer = enrolled.config.peers[0];
        const iface = enrolled.config.interface;

        // Очищаем публичный ключ от PEM-заголовков (на случай, если Cloudflare их вернет)
        const cleanPublicKey = peer.public_key
            .replace(/-----BEGIN PUBLIC KEY-----\n?/, '')
            .replace(/-----END PUBLIC KEY-----\n?/, '')
            .replace(/\n/g, '')
            .trim();

        return {
            privKey: privKeySec1,
            peer_pub: cleanPublicKey,
            client_ipv4: iface.addresses.v4,
            client_ipv6: iface.addresses.v6
        };
    } catch (error) {
        console.error('Ошибка при получении данных от Cloudflare MASQUE:', error.message);
        return null;
    }
}

module.exports = { getMSQData };