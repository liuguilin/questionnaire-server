/**
 * MongoDB 连接
 *
 * 与工程初始化（commit 2eac1c0）一致：
 *   connectionString      — 远程备用（无账号，未使用）
 *   localConnectionString — 实际连接（服务端同机 Mongo）
 */
const mongoose = require('mongoose');

// 远程连接字符串（备用）
const connectionString = 'mongodb://8.210.252.35:27017/SW_Tracking?authSource=admin';

// 本地连接（实际使用）
const localConnectionString =
  'mongodb://hkuapp:yuanziHKU240327@localhost:27017/SW_Tracking?authSource=admin';

const connectDatabase = () => {
  mongoose
    .connect(localConnectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log('MongoDB connected successfully to SW_Tracking database (localhost)');
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err);
    });
};

module.exports = {
  connectDatabase,
  connectionString,
  localConnectionString,
};
