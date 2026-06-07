/**
 * SW Tracking 问卷后端服务
 *
 * 提供 POST /api/submit 接口，接收 App 端提交的早/晚问卷答案及位置数据，
 * 存储至 MongoDB 的 SW_Qes_Result_Day / SW_Qes_Result_Night 集合。
 * 提供 GET /api/result 接口，按 uid 查询已保存的问卷结果。
 *
 * 安全机制：请求需携带 timestamp + enc，enc 为时间戳的 SHA256 哈希衍生值，
 * 用于防止重放攻击和非法请求。
 */
const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const mongoose = require('mongoose');
const crypto = require('crypto');

const app = new Koa();
const router = new Router();

// ---------- 加密配置 ----------
const ENCRYPTION_KEY = 240327; // 基础密钥，与 App 端保持一致
const SALT = 'SW_Tracking_2024'; // 盐值，增加哈希复杂度
const TIMESTAMP_EXPIRY = 120 * 60 * 1000; // 时间戳有效期：2 小时（毫秒）

/**
 * 根据 Unix 时间戳生成 10 位数字加密值
 * 算法：SHA256(timestamp + SALT + KEY) → 提取数字字符 → 取前 10 位
 */
function generateEncryptedTimestamp(timestamp) {
    const combined = `${timestamp}${SALT}${ENCRYPTION_KEY}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    // 取hash的前10位数字
    const numericHash = hash.replace(/[^0-9]/g, '').substring(0, 10);
    return numericHash;
}

/**
 * 验证客户端提交的 timestamp 与 enc 是否合法
 * 1. 长度校验：两者均须为 10 位
 * 2. 加密值校验：enc 须与本地重新计算的结果一致
 * 3. 时效校验：timestamp 与当前时间差不超过 TIMESTAMP_EXPIRY
 */
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

// ---------- MongoDB 连接 ----------
// 远程连接字符串（备用）
const connectionString = 'mongodb://8.210.252.35:27017/SW_Tracking?authSource=admin';
// 本地开发连接
const localConnectionString = 'mongodb://hkuapp:yuanziHKU240327@localhost:27017/SW_Tracking?authSource=admin';
mongoose.connect(localConnectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected successfully to SW_Tracking database');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// ---------- 数据模型 ----------
/** 位置信息子文档：经纬度、地址、采集时间 */
const locationSchema = new mongoose.Schema({
    lat: Number,
    lng: Number,
    address: String,
    time: String
});

/**
 * 问卷结果 Schema，早/晚问卷共用
 * - uid + type + date 组合作为业务唯一键，同一天同设备同类型只保留一条记录
 * - answers: [{ qid, answer }] 与 H5 提交的 qid 对应
 */
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

// 早问卷 → SW_Qes_Result_Day 集合；晚问卷 → SW_Qes_Result_Night 集合
const DayResult = mongoose.model('SW_Qes_Result_Day', questionResultSchema, 'SW_Qes_Result_Day');
const NightResult = mongoose.model('SW_Qes_Result_Night', questionResultSchema, 'SW_Qes_Result_Night');

app.use(async (ctx, next) => {
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type');
    if (ctx.method === 'OPTIONS') {
        ctx.status = 204;
        return;
    }
    await next();
});

app.use(bodyParser());

/**
 * POST /api/submit — 提交或更新问卷答案
 *
 * 请求体字段：
 *   type      - 'day' | 'night'
 *   uid       - 设备/用户唯一标识
 *   answers   - 答案数组 [{ qid, answer }]
 *   locations - 位置数组（可选，空数组时不覆盖已有位置）
 *   timestamp - Unix 秒级时间戳
 *   enc       - 时间戳加密值
 *   platform  - 客户端平台（ios/android）
 *   date      - 业务日期 YYYY-MM-DD（可选，用于查重）
 *
 * 更新策略：
 *   - 同 uid + type + date 已有记录 → 覆盖
 *   - locations 为空 → 仅更新 answers，保留原 locations
 *   - locations 非空 → 同时覆盖 answers 和 locations
 *   - 无匹配记录 → 新建，date 取服务器当天日期
 */
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

        // 根据问卷类型选择对应 MongoDB Model
        const Model = type === 'day' ? DayResult : NightResult;
        
        const queryDate = date || '';
        
        // 按 uid + date + type 查找是否已有当日记录
        const existingRecord = await Model.findOne({
            uid: uid,
            date: queryDate,
            type: type
        });
        
        let result;
        if (existingRecord) {
            if (!locations || locations.length === 0) {
                // 无新位置数据：只更新答案，保留历史位置轨迹
                result = await Model.findByIdAndUpdate(
                    existingRecord._id,
                    { 
                        answers: answers,
                        timestamp: new Date()
                    },
                    { new: true }
                );
            } else {
                // 有新位置数据：答案和位置一并覆盖
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
            // 首次提交：使用服务器 UTC 日期作为记录日期
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

/**
 * GET /api/result — 查询已保存的问卷结果
 *
 * Query 参数：
 *   uid  - 设备/用户唯一标识（必填）
 *   type - 'day' | 'night'，默认 day
 *   date - 业务日期 YYYY-MM-DD（可选；不传则返回该 uid 最近一条）
 */
router.get('/api/result', async (ctx) => {
    try {
        const { uid, type = 'day', date } = ctx.query;

        if (!uid) {
            ctx.status = 400;
            ctx.body = { error: 'params-error', message: 'uid is required' };
            return;
        }

        if (type !== 'day' && type !== 'night') {
            ctx.status = 400;
            ctx.body = { error: 'type-error' };
            return;
        }

        const Model = type === 'day' ? DayResult : NightResult;
        const query = { uid: String(uid), type: String(type) };

        if (date) {
            query.date = String(date);
        }

        const result = await Model.findOne(query).sort({ timestamp: -1 });

        if (!result) {
            ctx.status = 404;
            ctx.body = { success: false, error: 'not-found' };
            return;
        }

        ctx.status = 200;
        ctx.body = {
            success: true,
            data: result
        };
    } catch (error) {
        console.error('Error fetching result:', error);
        ctx.status = 500;
        ctx.body = {
            success: false,
            error: 'server-error-handled'
        };
    }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
