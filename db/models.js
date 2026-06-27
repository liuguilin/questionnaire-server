/**
 * 问卷结果数据模型（Mongoose Schema）
 *
 * 早/晚问卷各一张表，结构相同，由 routes/questionnaire.js 按 type 读写。
 * 唯一键逻辑：uid + date + type（见 services/questionnaireService.js upsert）
 *
 * 语音日记只存元数据；音频文件在 uploads/voice-diary/，filename 与此处对应。
 */
const mongoose = require('mongoose');

/** 客户端上报的定位点 */
const locationSchema = new mongoose.Schema({
    lat: Number,
    lng: Number,
    address: String,
    time: String
});

/** 单条问卷提交记录（早/晚共用） */
const questionResultSchema = new mongoose.Schema({
    uid: { type: String, required: true },           // 设备唯一 ID
    type: { type: String, enum: ['day', 'night'], required: true },
    answers: [{                                       // [{ qid, answer }]；晚问卷 q9 为录音时长
        qid: Number,
        answer: mongoose.Schema.Types.Mixed
    }],
    locations: [locationSchema],
    voiceDiary: {                                     // 仅晚问卷且有上传音频时有值
        filename: String,                             // 磁盘文件名，用于 /api/voice-diary 播放
        originalName: String,                         // 客户端原始文件名
        duration: Number,                           // 秒，来自 voiceDiaryDuration 或 q9
        mimeType: String,
        size: Number,
        playUrl: String                               // mp4 完整播放链接，如 https://host/api/voice-diary/xxx.mp4?uid=...
    },
    timestamp: { type: Date, default: Date.now },     // 最近一次提交时间
    platform: String,                                 // 如 iOS / web
    date: { type: String, required: true }            // 问卷日期 YYYY-MM-DD
});

/** 早问卷集合 SW_Qes_Result_Day */
const DayResult = mongoose.model('SW_Qes_Result_Day', questionResultSchema, 'SW_Qes_Result_Day');

/** 晚问卷集合 SW_Qes_Result_Night（含 voiceDiary） */
const NightResult = mongoose.model('SW_Qes_Result_Night', questionResultSchema, 'SW_Qes_Result_Night');

module.exports = {
    DayResult,
    NightResult
};
