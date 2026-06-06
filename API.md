# 社工追踪系统 API 文档

## 提交问卷答案接口

### 接口信息
- 请求方法：POST
- 接口地址：`/api/submit`
- Content-Type: application/json

### 请求参数
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 是 | 问卷类型，可选值：'day'（日间）或 'night'（夜间） |
| timestamp | number | 是 | 10位时间戳（秒级） |
| enc | string | 是 | 时间戳的加密值，10位数字 |
| answers | array | 是 | 答案数组 |
| locations | array | 是 | 位置信息数组 |

### answers 数组格式
```json
[
    {
        "qid": 1,           // 问题ID
        "answer": "yes"     // 答案内容
    }
]
```

### locations 数组格式
```json
[
    {
        "lat": 22.3193,     // 纬度
        "lng": 114.1694,    // 经度
        "address": "位置描述",
        "time": "2024-03-20T10:00:00.000Z"  // ISO格式时间
    }
]
```

### 时间戳验证
1. 时间戳和加密值必须为10位
2. 时间戳必须在当前时间前后3分钟内
3. 加密值必须与时间戳匹配

可以使用 `generate_timestamp.js` 生成有效的时间戳和加密值：
```bash
node generate_timestamp.js
```

### 响应格式
成功响应：
```json
{
    "success": true,
    "message": "answer-saved",
    "data": {
        // 保存的数据
    }
}
```

错误响应：
```json
{
    "error": "错误代码"
}
```

### 错误代码说明
| 错误代码 | 说明 |
|----------|------|
| params-error | 参数错误 |
| invalid | 时间戳验证失败 |
| type-error | 问卷类型错误 |
| answers-format-error | 答案格式错误 |
| locations-format-error | 位置数据格式错误 |
| answer-format-error | 单个答案格式错误 |
| location-format-error | 单个位置数据格式错误 |
| server-error | 服务器错误 | 