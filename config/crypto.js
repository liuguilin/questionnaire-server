const crypto = require('crypto');

const ENCRYPTION_KEY = 240327;
const SALT = 'SW_Tracking_2024';
const TIMESTAMP_EXPIRY = 120 * 60 * 1000;

function generateEncryptedTimestamp(timestamp) {
    const combined = `${timestamp}${SALT}${ENCRYPTION_KEY}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    return hash.replace(/[^0-9]/g, '').substring(0, 10);
}

/**
 * 验证客户端提交的 timestamp 与 enc 是否合法
 */
function validateTimestamp(timestamp, encryptedValue) {
    try {
        if (timestamp.toString().length !== 10 || encryptedValue.toString().length !== 10) {
            return false;
        }

        const expectedEncrypted = generateEncryptedTimestamp(timestamp);
        if (expectedEncrypted !== encryptedValue) {
            return false;
        }

        const currentTimestamp = Math.floor(Date.now() / 1000);
        const timeDiff = Math.abs(currentTimestamp - timestamp);
        return timeDiff <= (TIMESTAMP_EXPIRY / 1000);
    } catch (error) {
        console.error('验证过程出错:', error);
        return false;
    }
}

module.exports = {
    validateTimestamp
};
