/**
 * 时间戳加密工具 — 用于手动测试 / Postman 调试
 *
 * 生成当前 Unix 时间戳及其 enc 值，可直接复制到 Postman 请求体中。
 * 运行：node generate_timestamp.js
 */
const crypto = require('crypto');

// 加密配置（须与 app.js 保持一致）
const ENCRYPTION_KEY = 240327;
const SALT = 'SW_Tracking_2024';

/** 将 Unix 时间戳转为 10 位数字 enc 值 */
function generateEncryptedTimestamp(timestamp) {
    const combined = `${timestamp}${SALT}${ENCRYPTION_KEY}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    // 取hash的前10位数字
    const numericHash = hash.replace(/[^0-9]/g, '').substring(0, 10);
    return numericHash;
}

// 生成当前秒级时间戳及对应 enc
console.log("当前时间戳，取用 Date.now() 方法: " + Date.now());
const timestamp = Math.floor(Date.now() / 1000);
console.log("除以 1000: " + timestamp);
const enc = generateEncryptedTimestamp(timestamp);
console.log("时间戳加密值: " + enc);

console.log('时间戳和加密值:');
console.log('timestamp:', timestamp);
console.log('enc:', enc);

// 输出可直接粘贴到 Postman Body 的 JSON 片段
console.log('\n用于 Postman 的 JSON 格式:');
console.log(JSON.stringify({
    timestamp,
    enc
}, null, 2)); 