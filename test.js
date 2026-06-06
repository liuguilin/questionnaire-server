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

// 测试数据
const testData = {
    type: 'day',
    uid: 'test-device-001',
    answers: [
        { qid: 1, answer: 'yes' },
        { qid: 2, answer: 'no' }
    ],
    locations: [
        {
            lat: 22.3193,
            lng: 114.1694,
            address: 'Test Location',
            time: new Date().toISOString()
        }
    ],
    platform: 'ios'
};

// 生成时间戳和加密值
const timestamp = Math.floor(Date.now() / 1000);
const enc = generateEncryptedTimestamp(timestamp);

// 添加时间戳和加密值到测试数据
testData.timestamp = timestamp;
testData.enc = enc;

// 测试函数
async function runTest(testName, data) {
    console.log(`\n=== ${testName} ===`);
    console.log('Sending data:', JSON.stringify(data, null, 2));
    
    const localLink = 'http://localhost:3000/api/submit';
    const serverLink = 'http://8.210.252.35:3000/api/submit';
    
    try {
        const response = await fetch(localLink, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        console.log('Response:', result);
        return result;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

// 运行测试
async function runAllTests() {
    // 测试1: 首次提交（带位置数据）
    await runTest('Test 1: First submission with locations', testData);
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试2: 同一天同设备，只更新答案（无位置数据）
    const testData2 = {
        ...testData,
        answers: [
            { qid: 1, answer: 'no' },
            { qid: 2, answer: 'yes' },
            { qid: 3, answer: 'maybe' }
        ],
        locations: [], // 空位置数组
        timestamp: Math.floor(Date.now() / 1000),
        enc: generateEncryptedTimestamp(Math.floor(Date.now() / 1000))
    };
    await runTest('Test 2: Update answers only (empty locations)', testData2);
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试3: 同一天同设备，更新位置数据
    const testData3 = {
        ...testData,
        answers: [
            { qid: 1, answer: 'updated' },
            { qid: 2, answer: 'new answer' }
        ],
        locations: [
            {
                lat: 22.3193,
                lng: 114.1694,
                address: 'Updated Location',
                time: new Date().toISOString()
            },
            {
                lat: 22.3200,
                lng: 114.1700,
                address: 'Second Location',
                time: new Date().toISOString()
            }
        ],
        timestamp: Math.floor(Date.now() / 1000),
        enc: generateEncryptedTimestamp(Math.floor(Date.now() / 1000))
    };
    await runTest('Test 3: Update with new locations', testData3);
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试4: 不同设备，应该创建新记录
    const testData4 = {
        ...testData,
        uid: 'test-device-002', // 不同的设备ID
        answers: [
            { qid: 1, answer: 'different device' }
        ],
        locations: [
            {
                lat: 22.3000,
                lng: 114.1500,
                address: 'Different Device Location',
                time: new Date().toISOString()
            }
        ],
        timestamp: Math.floor(Date.now() / 1000),
        enc: generateEncryptedTimestamp(Math.floor(Date.now() / 1000))
    };
    await runTest('Test 4: Different device (should create new record)', testData4);
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试5: 不同类型（night），应该创建新记录
    const testData5 = {
        ...testData,
        type: 'night', // 不同的类型
        answers: [
            { qid: 1, answer: 'night answer' }
        ],
        locations: [
            {
                lat: 22.3193,
                lng: 114.1694,
                address: 'Night Location',
                time: new Date().toISOString()
            }
        ],
        timestamp: Math.floor(Date.now() / 1000),
        enc: generateEncryptedTimestamp(Math.floor(Date.now() / 1000))
    };
    await runTest('Test 5: Different type (night)', testData5);
}

// 运行所有测试
runAllTests(); 