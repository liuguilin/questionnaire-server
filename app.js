const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const mongoose = require('mongoose');
const crypto = require('crypto');

const app = new Koa();
const router = new Router();

// 加密配置
const ENCRYPTION_KEY = 240327; // 基础密钥
const SALT = 'SW_Tracking_2024'; // 盐值
const TIMESTAMP_EXPIRY = 120 * 60 * 1000; // 2 hours

// 生成加密时间戳
function generateEncryptedTimestamp(timestamp) {
    const combined = `${timestamp}${SALT}${ENCRYPTION_KEY}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    // 取hash的前10位数字
    const numericHash = hash.replace(/[^0-9]/g, '').substring(0, 10);
    return numericHash;
}

// 验证时间戳
function validateTimestamp(timestamp, encryptedValue) {
    try {
        console.log('验证时间戳:', {
            timestamp,
            encryptedValue,
            currentTime: Math.floor(Date.now() / 1000)
        });

        // 检查时间戳和加密值是否为10位
        if (timestamp.toString().length !== 10 || encryptedValue.toString().length !== 10) {
            console.log('长度验证失败:', {
                timestampLength: timestamp.toString().length,
                encryptedValueLength: encryptedValue.toString().length
            });
            return false;
        }

        // 验证加密值是否正确
        const expectedEncrypted = generateEncryptedTimestamp(timestamp);
        console.log('加密值比对:', {
            expected: expectedEncrypted,
            received: encryptedValue
        });
        if (expectedEncrypted !== encryptedValue) {
            console.log('加密值不匹配');
            return false;
        }

        // 检查时间戳是否在有效期内（前后3分钟）
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const timeDiff = Math.abs(currentTimestamp - timestamp);
        console.log('时间差检查:', {
            currentTimestamp,
            timeDiff,
            maxAllowed: TIMESTAMP_EXPIRY / 1000
        });
        return timeDiff <= (TIMESTAMP_EXPIRY / 1000);
    } catch (error) {
        console.error('验证过程出错:', error);
        return false;
    }
}

// connect MongoDB
const connectionString = 'mongodb://8.210.252.35:27017/SW_Tracking?authSource=admin';
const localConnectionString = 'mongodb://hkuapp:yuanziHKU240327@localhost:27017/SW_Tracking?authSource=admin';
mongoose.connect(localConnectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected successfully to SW_Tracking database');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// define Schema
const locationSchema = new mongoose.Schema({
    lat: Number,
    lng: Number,
    address: String,
    time: String
});

const questionResultSchema = new mongoose.Schema({
    uid: { type: String, required: true },
    type: { type: String, enum: ['day', 'night'], required: true },
    answers: [{
        qid: Number,
        answer: mongoose.Schema.Types.Mixed
    }],
    locations: [locationSchema],
    timestamp: { type: Date, default: Date.now },
    platform: String,
    date: { type: String, required: true } // 格式: YYYY-MM-DD
});

// create model with explicit collection names
const DayResult = mongoose.model('SW_Qes_Result_Day', questionResultSchema, 'SW_Qes_Result_Day');
const NightResult = mongoose.model('SW_Qes_Result_Night', questionResultSchema, 'SW_Qes_Result_Night');

// use bodyParser middleware
app.use(bodyParser());

// define router
router.post('/api/submit', async (ctx) => {
    try {
        const { type, answers, locations, timestamp, enc, platform, uid, date } = ctx.request.body;
        
        // 验证必要参数
        if (!type || !timestamp || !enc || !uid) {
            ctx.status = 400;
            ctx.body = { error: 'params-error' };
            return;
        }

        // 验证时间戳
        if (!validateTimestamp(timestamp, enc)) {
            ctx.status = 400;
            ctx.body = { error: 'invalid' };
            return;
        }

        if (type !== 'day' && type !== 'night') {
            ctx.status = 400;
            ctx.body = { error: 'type-error' };
            return;
        }

        const Model = type === 'day' ? DayResult : NightResult;
        
        // 确定用于查询的日期
        // 如果提供了 date，使用它；否则使用空字符串
        const queryDate = date || '';
        
        // 检查是否存在相同 uid、type、date 的记录
        const existingRecord = await Model.findOne({
            uid: uid,
            date: queryDate,
            type: type
        });
        
        let result;
        if (existingRecord) {
            // 如果找到记录，进行覆盖
            if (!locations || locations.length === 0) {
                // 如果locations为空，只覆盖answers，不覆盖locations
                result = await Model.findByIdAndUpdate(
                    existingRecord._id,
                    { 
                        answers: answers,
                        timestamp: new Date()
                    },
                    { new: true }
                );
            } else {
                // 如果locations不为空，完全覆盖位置数据（包括answers和locations）
                result = await Model.findByIdAndUpdate(
                    existingRecord._id,
                    { 
                        answers: answers,
                        locations: locations,
                        timestamp: new Date()
                    },
                    { new: true }
                );
            }
        } else {
            // 如果没找到记录，创建新记录
            // 新记录的date使用服务器时间生成
            const serverDate = new Date().toISOString().split('T')[0];
            result = await Model.create({
                uid: uid,
                type: type,
                answers: answers,
                locations: locations,
                platform: platform,
                date: serverDate
            });
        }

        ctx.status = 200;
        ctx.body = {
            success: true,
            message: 'answer-saved',
            data: result
        };
    } catch (error) {
        console.error('Error saving answers:', error);
        ctx.status = 500;
        ctx.body = {
            success: false,
            error: 'server-error-handled'
        };
    }
});

// use router middleware
app.use(router.routes()).use(router.allowedMethods());

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
