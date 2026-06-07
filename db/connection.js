/**
 * MongoDB 连接
 *
 * 在 app.js 启动时调用 connectDatabase()，连接 SW_Tracking 库。
 * 连接串可通过环境变量 MONGO_URI 覆盖，便于本地/部署切换。
 */
const mongoose = require('mongoose');

const localConnectionString =
  process.env.MONGO_URI ||
  'mongodb://hkuapp:yuanziHKU240327@8.210.252.35:27017/SW_Tracking?authSource=admin';

const connectDatabase = () => {
    mongoose.connect(localConnectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log('MongoDB connected successfully to SW_Tracking database');
    }).catch(err => {
        console.error('MongoDB connection error:', err);
    });
};

module.exports = {
    connectDatabase
};
