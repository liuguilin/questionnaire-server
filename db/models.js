/**
 * 数据模型
 *
 * - SW_Qes_Result_Day / SW_Qes_Result_Night：问卷与免问卷共用
 *   · mode=quest：有问卷（answers / 可选 voiceDiary）
 *   · mode=noQuest：免问卷（主要写 locations）
 *
 * upsert 键：uid + date + type + mode
 */
const mongoose = require('mongoose');

/** 客户端上报的定位点 */
const locationSchema = new mongoose.Schema({
    lat: Number,
    lng: Number,
    address: String,
    time: String
});

/** 单条记录（早/晚共用） */
const questionResultSchema = new mongoose.Schema({
    uid: { type: String, required: true },
    type: { type: String, enum: ['day', 'night'], required: true },
    /** quest=有问卷，noQuest=免问卷；与客户端 selectMode 一致 */
    mode: { type: String, enum: ['quest', 'noQuest'], default: 'quest' },
    answers: [{
        qid: Number,
        answer: mongoose.Schema.Types.Mixed
    }],
    locations: [locationSchema],
    voiceDiary: {                                     // 仅晚问卷有文件时写入；否则文档无此字段
        filename: String,
        originalName: String,
        duration: Number,
        mimeType: String,
        size: Number,
        playUrl: String
    },
    timestamp: { type: Date, default: Date.now },
    platform: String,
    date: { type: String, required: true }
});

const DayResult = mongoose.model('SW_Qes_Result_Day', questionResultSchema, 'SW_Qes_Result_Day');
const NightResult = mongoose.model('SW_Qes_Result_Night', questionResultSchema, 'SW_Qes_Result_Night');

module.exports = {
    DayResult,
    NightResult
};
