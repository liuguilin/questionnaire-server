const { DayResult, NightResult } = require('../db/models');
const { getServerDate } = require('../utils/date');
const { buildVoiceDiaryPlayUrl } = require('./voiceDiaryService');

/** multipart 提交时问卷 JSON 在 data 字段；纯 JSON 提交时 body 即为 payload */
const parseSubmitPayload = (body) => {
    if (typeof body.data === 'string') {
        return JSON.parse(body.data);
    }
    return body;
};

/** 从 multer 上传结果构建 MongoDB 中的 voiceDiary 元数据（含 playUrl）
 * 无 file 时返回 undefined → 新建/更新都不会写入 voiceDiary 字段（不是空对象）
 */
const buildVoiceDiaryMeta = (file, duration, uid, origin) => {
    if (!file) {
        return undefined;
    }

    const meta = {
        filename: file.filename,
        originalName: file.originalname,
        duration,
        mimeType: file.mimetype,
        size: file.size
    };

    if (uid && origin) {
        meta.playUrl = buildVoiceDiaryPlayUrl(file.filename, uid, origin);
    }

    return meta;
};

/** 规范化 mode；缺省 / 非法回退 quest（兼容旧客户端） */
const normalizeMode = (mode) => (mode === 'noQuest' ? 'noQuest' : 'quest');

/**
 * 查重条件：uid + date + type + mode
 * 历史数据可能无 mode 字段，查 quest 时一并匹配缺失 mode 的旧记录
 */
const buildModeQuery = (mode) => {
    if (mode === 'noQuest') {
        return { mode: 'noQuest' };
    }
    return {
        $or: [
            { mode: 'quest' },
            { mode: { $exists: false } },
            { mode: null }
        ]
    };
};

/** 按 uid + date + type + mode upsert（问卷 / 免问卷同一集合）
 * - answers / voiceDiary 不强制；answers 不传时更新不覆盖原 answers
 * - locations 为空或不传：更新时保留库中原 locations
 * - locations 非空：一并覆盖 locations
 */
const saveQuestionnaireResult = async ({
    type,
    mode,
    answers,
    locations,
    platform,
    uid,
    date,
    voiceDiary
}) => {
    const resolvedMode = normalizeMode(mode);
    const Model = type === 'day' ? DayResult : NightResult;
    const queryDate = date || '';
    const existingRecord = await Model.findOne({
        uid,
        date: queryDate,
        type,
        ...buildModeQuery(resolvedMode)
    });

    const updatePayload = {
        mode: resolvedMode,
        timestamp: new Date()
    };

    if (answers !== undefined) {
        updatePayload.answers = answers;
    }

    if (voiceDiary) {
        updatePayload.voiceDiary = voiceDiary;
    }

    if (existingRecord) {
        if (!locations || locations.length === 0) {
            return Model.findByIdAndUpdate(existingRecord._id, updatePayload, { new: true });
        }

        return Model.findByIdAndUpdate(
            existingRecord._id,
            {
                ...updatePayload,
                locations
            },
            { new: true }
        );
    }

    return Model.create({
        uid,
        type,
        mode: resolvedMode,
        answers: answers || [],
        locations,
        platform,
        date: getServerDate(),
        voiceDiary: voiceDiary || undefined
    });
};

/**
 * 按 uid + type + mode 查询一条记录
 * - date 有值：查指定日期
 * - date 无值：返回该 uid+type+mode 最近一条（timestamp 降序）
 */
const findQuestionnaireResult = async ({ uid, type = 'day', mode, date }) => {
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

    return Model.findOne(query).sort({ timestamp: -1 });
};

module.exports = {
    parseSubmitPayload,
    buildVoiceDiaryMeta,
    saveQuestionnaireResult,
    findQuestionnaireResult,
    normalizeMode,
    buildModeQuery
};
