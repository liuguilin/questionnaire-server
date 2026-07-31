# 社工追踪系统 API 文档

**Base URL：** `http(s)://8.210.252.35:3000`

### enc 算法（所有提交接口共用）

```
SHA256("{timestamp}SW_Tracking_2024" + "240327") → 去非数字 → 前 10 位
```

可用 `generate_timestamp.js` 生成。

---

## 1. 提交（问卷 / 免问卷共用）

### 接口信息
- 请求方法：POST
- 接口地址：`/api/submit`
- Content-Type: `application/json`（无语音）或 `multipart/form-data`（晚问卷带语音）

同一接口、同一两张表，用 **`mode`** 区分：
- `mode=quest`（默认）→ 有问卷
- `mode=noQuest` → 免问卷

集合：
- `type=day` → `SW_Qes_Result_Day`
- `type=night` → `SW_Qes_Result_Night`

upsert 键：`uid + date + type + mode`。

**不强制校验** `answers`、`voiceDiary` / `voiceDiaryDuration`（均可不传）。

| 场景 | mode | 建议传法 |
|------|------|----------|
| 有问卷 | `quest` | 带 `answers`；晚问卷可再带 `voiceDiary` |
| 免问卷 | `noQuest` | 不传 `answers`（或 `[]`）、不传语音；带 `locations` |

> 旧客户端不传 `mode` 时按 `quest` 处理。历史无 `mode` 字段的记录查 `quest` 时仍可匹配。

### 请求参数
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 是 | `day` / `night` |
| uid | string | 是 | 设备/用户唯一标识 |
| timestamp | number | 是 | 10 位时间戳（秒级） |
| enc | string | 是 | 时间戳加密值，10 位数字 |
| mode | string | 否 | `quest` / `noQuest`，默认 `quest` |
| answers | array | 否 | 问卷答案；免问卷不传或 `[]`；不传时更新不覆盖原 answers |
| locations | array | 否 | 位置；空或不传时更新不覆盖原 locations |
| platform | string | 否 | ios / android |
| date | string | 否 | YYYY-MM-DD（查重用；新建写入服务器当天日期） |
| voiceDiary | file | 否 | 仅晚问卷 multipart |
| voiceDiaryDuration | number | 否 | 录音秒数；无文件时忽略 |

### `voiceDiary` 入库说明
- 未上传音频 → 文档中**无** `voiceDiary` 字段
- 有上传 → 含 `filename` / `originalName` / `duration` / `mimeType` / `size` / `playUrl`

### 免问卷示例
```json
{
  "uid": "84a8192c2713408e8863fdb5b79725ea",
  "mode": "noQuest",
  "type": "day",
  "timestamp": 1720000000,
  "enc": "1234567890",
  "platform": "android",
  "date": "2026-07-31",
  "locations": [
    {
      "lat": 22.3193,
      "lng": 114.1694,
      "address": "Hong Kong",
      "time": "2026-07-31T10:00:00.000Z"
    }
  ]
}
```

### 响应
成功：`{ "success": true, "message": "answer-saved", "data": { ... } }`

| 错误代码 | 说明 |
|----------|------|
| params-error | 缺 type / uid / timestamp / enc 等 |
| invalid | 时间戳验证失败 |
| type-error | type 非法 |
| mode-error | mode 非法（非 quest/noQuest） |
| voice-diary-format-error | 上传了非 audio/* 文件 |
| server-error-handled | 服务器错误 |

---

## 2. 查询结果

```http
GET /api/result?uid=xxx&type=day|night&mode=quest|noQuest&date=可选
```

| 参数 | 必填 | 说明 |
|------|------|------|
| uid | 是 | |
| type | 否 | 默认 `day` |
| mode | 否 | 默认 `quest`；`noQuest` 查免问卷 |
| date | 否 | 不传则该 uid+type+mode 最近一条 |

示例：

```bash
# 有问卷
curl 'http://localhost:3000/api/result?uid=xxx&type=day&mode=quest'

# 免问卷
curl 'http://localhost:3000/api/result?uid=xxx&type=day&mode=noQuest&date=2026-07-31'
```

---

## 3. 集合字段

| 字段 | 说明 |
|------|------|
| uid / type / date / mode | mode：`quest` \| `noQuest` |
| answers | 免问卷常为 `[]` |
| locations | 可空 |
| voiceDiary | 仅有语音时存在 |
| timestamp / platform | |
| _id / __v | 自动字段 |
