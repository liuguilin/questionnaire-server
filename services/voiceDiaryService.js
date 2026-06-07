const fs = require('fs');
const path = require('path');
const { DayResult, NightResult } = require('../db/models');

const voiceDiaryUploadDir = path.join(__dirname, '..', 'uploads', 'voice-diary');
const SAFE_FILENAME_PATTERN = /^[\w.-]+$/;

/** 防止路径穿越，只允许 multer 生成的安全文件名 */
const isSafeFilename = (filename) => SAFE_FILENAME_PATTERN.test(filename);

const getVoiceDiaryFilePath = (filename) => {
    if (!isSafeFilename(filename)) {
        return null;
    }

    const filePath = path.join(voiceDiaryUploadDir, filename);
    if (!filePath.startsWith(voiceDiaryUploadDir)) {
        return null;
    }

    return filePath;
};

/** 校验 uid 是否拥有该语音文件（早/晚问卷均查） */
const findVoiceDiaryRecord = async (uid, filename) => {
    const query = {
        uid: String(uid),
        'voiceDiary.filename': filename
    };

    const nightRecord = await NightResult.findOne(query);
    if (nightRecord) {
        return nightRecord;
    }

    return DayResult.findOne(query);
};

const buildVoiceDiaryPlayPath = (filename, uid) => {
    const params = new URLSearchParams({ uid: String(uid) });
    return `/api/voice-diary/${encodeURIComponent(filename)}?${params.toString()}`;
};

const buildVoiceDiaryPlayUrl = (filename, uid, origin) => {
    const path = buildVoiceDiaryPlayPath(filename, uid);
    if (!origin) {
        return path;
    }

    return `${origin.replace(/\/$/, '')}${path}`;
};

const appendVoiceDiaryPlayUrl = (record, uid, origin) => {
    if (!record || !record.voiceDiary?.filename) {
        return record;
    }

    const data = typeof record.toObject === 'function' ? record.toObject() : { ...record };

    data.voiceDiary = {
        ...data.voiceDiary,
        playUrl: buildVoiceDiaryPlayUrl(data.voiceDiary.filename, uid, origin)
    };

    return data;
};

const streamVoiceDiaryFile = async (filename, uid) => {
    if (!uid) {
        return { error: 'params-error', status: 400 };
    }

    if (!isSafeFilename(filename)) {
        return { error: 'invalid-filename', status: 400 };
    }

    const record = await findVoiceDiaryRecord(uid, filename);
    if (!record) {
        return { error: 'not-found', status: 404 };
    }

    const filePath = getVoiceDiaryFilePath(filename);
    if (!filePath || !fs.existsSync(filePath)) {
        return { error: 'file-not-found', status: 404 };
    }

    return {
        stream: fs.createReadStream(filePath),
        mimeType: record.voiceDiary.mimeType || 'application/octet-stream'
    };
};

module.exports = {
    buildVoiceDiaryPlayUrl,
    appendVoiceDiaryPlayUrl,
    streamVoiceDiaryFile
};
