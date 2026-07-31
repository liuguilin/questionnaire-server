/**
 * 问卷 API 路由
 *
 * POST /api/submit          提交（问卷 / 免问卷共用；用 mode 区分）
 * GET  /api/result          查询（mode 区分有问卷 / 免问卷）
 * GET  /api/voice-diary/:filename  播放语音日记（需 uid 鉴权）
 */
const Router = require('koa-router');
const { validateTimestamp } = require('../config/crypto');
const { DayResult, NightResult } = require('../db/models');
const { voiceDiaryUploadMiddleware } = require('../middleware/voiceDiaryUpload');
const {
    parseSubmitPayload,
    buildVoiceDiaryMeta,
    saveQuestionnaireResult,
    normalizeMode,
    buildModeQuery
} = require('../services/questionnaireService');
const {
    appendVoiceDiaryPlayUrl,
    streamVoiceDiaryFile
} = require('../services/voiceDiaryService');

const router = new Router();

/** 从请求推断对外访问根地址，用于组装完整音频播放链接 */
const getRequestOrigin = (ctx) => {
    const proto = ctx.get('x-forwarded-proto') || ctx.protocol;
    const host = ctx.get('x-forwarded-host') || ctx.host;
    return `${proto}://${host}`;
};

/**
 * 提交（问卷 / 免问卷共用，写入原 Day / Night 表）
 *
 * 无语音：Content-Type application/json
 *   必填：type（day|night）, uid, timestamp, enc
 *   可选：mode（quest|noQuest，默认 quest）
 *   可选：answers（免问卷不传或 []）, locations, platform, date
 *   可选：voiceDiary（仅晚问卷 multipart 有文件时入库；无文件则文档无此字段）
 *   可选：voiceDiaryDuration（秒；无文件时忽略）
 *
 * 有语音（晚问卷）：Content-Type multipart/form-data
 *   问卷字段：JSON body 或 data 字段（见 parseSubmitPayload）
 *   文件字段：voiceDiary（audio/*，≤10MB）
 *   可选：voiceDiaryDuration（秒，写入 voiceDiary.duration）
 *
 * upsert 键：uid + date + type + mode
 *   locations 空或不传：更新不覆盖原 locations
 *   answers 不传：更新不覆盖原 answers
 *   无 voiceDiary 文件：不写 / 不覆盖 voiceDiary
 */
router.post('/api/submit', voiceDiaryUploadMiddleware, async (ctx) => {
    try {
        let payload;
        try {
            payload = parseSubmitPayload(ctx.request.body);
        } catch (parseError) {
            ctx.status = 400;
            ctx.body = { error: 'params-error' };
            return;
        }

        const { type, mode, answers, locations, timestamp, enc, platform, uid, date } = payload;
        const voiceDiaryDuration = Number(ctx.request.body.voiceDiaryDuration || 0);

        if (!type || !timestamp || !enc || !uid) {
            ctx.status = 400;
            ctx.body = { error: 'params-error' };
            return;
        }

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

        if (mode != null && mode !== '' && mode !== 'quest' && mode !== 'noQuest') {
            ctx.status = 400;
            ctx.body = { error: 'mode-error' };
            return;
        }

        const result = await saveQuestionnaireResult({
            type,
            mode,
            answers,
            locations,
            platform,
            uid,
            date,
            voiceDiary: buildVoiceDiaryMeta(ctx.file, voiceDiaryDuration, uid, getRequestOrigin(ctx))
        });

        ctx.status = 200;
        ctx.body = {
            success: true,
            message: 'answer-saved',
            data: appendVoiceDiaryPlayUrl(result, uid, getRequestOrigin(ctx))
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
 * 查询结果
 *
 * Query：uid（必填）
 *        type（day|night，默认 day）
 *        mode（quest|noQuest，默认 quest；有问卷 / 免问卷）
 *        date（可选 YYYY-MM-DD）
 * 未传 date 时返回该 uid+type+mode 最近一条（按 timestamp 降序）
 */
router.get('/api/result', async (ctx) => {
    try {
        const { uid, type = 'day', mode, date } = ctx.query;

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

        if (mode != null && mode !== '' && mode !== 'quest' && mode !== 'noQuest') {
            ctx.status = 400;
            ctx.body = { error: 'mode-error' };
            return;
        }

        const resolvedMode = normalizeMode(mode);
        const Model = type === 'day' ? DayResult : NightResult;
        const query = {
            uid: String(uid),
            type: String(type),
            ...buildModeQuery(resolvedMode)
        };

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
            data: appendVoiceDiaryPlayUrl(result, uid, getRequestOrigin(ctx))
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

/**
 * 播放语音日记
 *
 * Path：filename（DB 中 voiceDiary.filename）
 * Query：uid（必填，须与拥有该文件的问卷记录一致）
 */
router.get('/api/voice-diary/:filename', async (ctx) => {
    try {
        const { filename } = ctx.params;
        const { uid } = ctx.query;
        const result = await streamVoiceDiaryFile(filename, uid);

        if (result.error) {
            ctx.status = result.status;
            ctx.body = { error: result.error };
            return;
        }

        ctx.type = result.mimeType;
        ctx.set('Accept-Ranges', 'bytes');
        ctx.set('Cache-Control', 'private, max-age=3600');
        ctx.body = result.stream;
    } catch (error) {
        console.error('Error streaming voice diary:', error);
        ctx.status = 500;
        ctx.body = {
            success: false,
            error: 'server-error-handled'
        };
    }
});

module.exports = router;
