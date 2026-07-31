/**
 * 共享日期工具（问卷 / 免问卷 upsert 共用）
 */
const getServerDate = () => new Date().toISOString().split('T')[0];

module.exports = {
    getServerDate
};
