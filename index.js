const express = require('express');
const path = require('path');
const app = express();

// Подключаем статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/warp-data', async (req, res) => {
    try {
        const { getWarpData } = require('./warp');
        const data = await getWarpData();
        if (data) {
            res.json({ success: true, ...data });
        } else {
            res.status(500).json({ success: false, message: 'Не удалось получить данные от Cloudflare' });
        }
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        res.status(500).json({ success: false, message: 'Произошла ошибка на сервере.' });
    }
});

app.get('/api/msq-data', async (req, res) => {
    try {
        const { getMSQData } = require('./msq');
        const data = await getMSQData();
        if (data) {
            res.json({ success: true, ...data });
        } else {
            res.status(500).json({ success: false, message: 'Не удалось получить данные от Cloudflare' });
        }
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        res.status(500).json({ success: false, message: 'Произошла ошибка на сервере.' });
    }
});

module.exports = app;
