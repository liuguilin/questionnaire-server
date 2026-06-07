const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('@koa/multer');

const voiceDiaryUploadDir = path.join(__dirname, '..', 'uploads', 'voice-diary');

if (!fs.existsSync(voiceDiaryUploadDir)) {
    fs.mkdirSync(voiceDiaryUploadDir, { recursive: true });
}

const voiceDiaryStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, voiceDiaryUploadDir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '.webm';
        cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
});

const voiceDiaryUpload = multer({
    storage: voiceDiaryStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
            return;
        }
        cb(new Error('invalid-audio-format'));
    }
});

/** 晚问卷语音文件字段：voiceDiary */
const voiceDiaryUploadMiddleware = voiceDiaryUpload.single('voiceDiary');

module.exports = {
    voiceDiaryUpload,
    voiceDiaryUploadMiddleware
};
