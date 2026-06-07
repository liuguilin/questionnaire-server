/**
 * SW Tracking 问卷后端服务入口
 *
 * 模块划分：
 * - config/crypto.js           时间戳校验
 * - db/connection.js           MongoDB 连接
 * - db/models.js               数据模型
 * - middleware/voiceDiaryUpload.js  语音日记 multer 上传（voiceDiary 字段）
 * - services/questionnaireService.js  问卷保存业务
 * - services/voiceDiaryService.js     语音日记播放
 * - routes/questionnaire.js    /api/submit、/api/result、/api/voice-diary 路由
 */
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const { connectDatabase } = require('./db/connection');
const questionnaireRouter = require('./routes/questionnaire');

const app = new Koa();

connectDatabase();

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

app.use(async (ctx, next) => {
    try {
        await next();
    } catch (error) {
        if (error.message === 'invalid-audio-format') {
            ctx.status = 400;
            ctx.body = { error: 'voice-diary-format-error' };
            return;
        }
        throw error;
    }
});

app.use(bodyParser());
app.use(questionnaireRouter.routes()).use(questionnaireRouter.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
