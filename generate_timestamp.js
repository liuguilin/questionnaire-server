const crypto = require('crypto');

// 加密配置
const ENCRYPTION_KEY = 240327; // 基础密钥
const SALT = 'SW_Tracking_2024'; // 盐值

// 生成加密时间戳
function generateEncryptedTimestamp(timestamp) {
    const combined = `${timestamp}${SALT}${ENCRYPTION_KEY}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    // 取hash的前10位数字
    const numericHash = hash.replace(/[^0-9]/g, '').substring(0, 10);
    return numericHash;
}

// 生成当前时间戳和加密值
console.log("当前时间戳，取用 Date.now() 方法: " + Date.now());
const timestamp = Math.floor(Date.now() / 1000);
console.log("除以 1000: " + timestamp);
const enc = generateEncryptedTimestamp(timestamp);
console.log("时间戳加密值: " + enc);

// 打印结果
console.log('时间戳和加密值:');
console.log('timestamp:', timestamp);
console.log('enc:', enc);

// 打印用于 Postman 的 JSON 格式
console.log('\n用于 Postman 的 JSON 格式:');
console.log(JSON.stringify({
    timestamp,
    enc
}, null, 2)); 