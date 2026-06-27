const { DayResult, NightResult } = require('../db/models');
const { buildVoiceDiaryPlayUrl } = require('./voiceDiaryService');

/** multipart 提交时问卷 JSON 在 data 字段；纯 JSON 提交时 body 即为 payload */
const parseSubmitPayload = (body) => {
    if (typeof body.data === 'string') {
        return JSON.parse(body.data);
    }
    return body;
};

/** 从 multer 上传结果构建 MongoDB 中的 voiceDiary 元数据（含 mp4 完整播放链接） */
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

/** 按 uid + date + type upsert 问卷记录 */
const saveQuestionnaireResult = async ({ type, answers, locations, platform, uid, date, voiceDiary }) => {
    const Model = type === 'day' ? DayResult : NightResult;
    const queryDate = date || '';
    const existingRecord = await Model.findOne({
        uid,
        date: queryDate,
        type
    });

    const updatePayload = {
        answers,
        timestamp: new Date()
    };

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

    const serverDate = new Date().toISOString().split('T')[0];
    return Model.create({
        uid,
        type,
        answers,
        locations,
        platform,
        date: serverDate,
        voiceDiary: voiceDiary || undefined
    });
};

module.exports = {
    parseSubmitPayload,
    buildVoiceDiaryMeta,
    saveQuestionnaireResult
};
