const fetch = require('node-fetch');
const nacl = require('tweetnacl');
const { Buffer } = require('buffer');

function generateKeys() {
    const keyPair = nacl.box.keyPair();
    return {
        privKey: Buffer.from(keyPair.secretKey).toString('base64'),
        pubKey: Buffer.from(keyPair.publicKey).toString('base64')
    };
}

async function apiRequest(method, endpoint, body = null, token = null) {
    const headers = {
        'User-Agent': '',
        'Content-Type': 'application/json',
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

    const response = await fetch(`https://api.cloudflareclient.com/v0i1909051800/${endpoint}`, options);
    return response.json();
}

// Функция для получения данных от Cloudflare без генерации конфига
async function getWarpData() {
    try {
        const { privKey, pubKey } = generateKeys();

        const regBody = {
            install_id: "",
            tos: new Date().toISOString(),
            key: pubKey,
            fcm_token: "",
            type: "ios",
            locale: "en_US"
        };
        
        const regResponse = await apiRequest('POST', 'reg', regBody);
        
        if (!regResponse.result || !regResponse.result.id) {
            throw new Error('Failed to register device');
        }

        const id = regResponse.result.id;
        const token = regResponse.result.token;

        const warpResponse = await apiRequest('PATCH', `reg/${id}`, { warp_enabled: true }, token);
        
        if (!warpResponse.result || !warpResponse.result.config) {
            throw new Error('Failed to enable WARP');
        }

        const peer_pub = warpResponse.result.config.peers[0].public_key;
        const peer_endpoint = warpResponse.result.config.peers[0].endpoint.host;
        const client_ipv4 = warpResponse.result.config.interface.addresses.v4;
        const client_ipv6 = warpResponse.result.config.interface.addresses.v6;

        return {
            privKey,
            peer_pub,
            client_ipv4,
            client_ipv6
        };
    } catch (error) {
        console.error('Ошибка при получении данных от Cloudflare:', error);
        return null;
    }
}

module.exports = { getWarpData };