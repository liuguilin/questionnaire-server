#import "SWTrackingAPI.h"
#import <CommonCrypto/CommonCrypto.h>

@implementation SWTrackingAPI

// 生成加密时间戳
+ (NSString *)generateEncryptedTimestamp:(NSInteger)timestamp {
    NSString *ENCRYPTION_KEY = @"240327";
    NSString *SALT = @"SW_Tracking_2024";
    
    // 组合字符串
    NSString *combined = [NSString stringWithFormat:@"%ld%@%@", (long)timestamp, SALT, ENCRYPTION_KEY];
    
    // 创建SHA256哈希
    const char *cStr = [combined UTF8String];
    unsigned char result[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(cStr, (CC_LONG)strlen(cStr), result);
    
    // 转换为十六进制字符串
    NSMutableString *hash = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
    for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
        [hash appendFormat:@"%02x", result[i]];
    }
    
    // 只保留数字并取前10位
    NSCharacterSet *nonDigits = [[NSCharacterSet decimalDigitCharacterSet] invertedSet];
    NSString *digitsOnly = [[hash componentsSeparatedByCharactersInSet:nonDigits] componentsJoinedByString:@""];
    return [digitsOnly substringToIndex:MIN(10, digitsOnly.length)];
}

// 提交数据
+ (void)submitDataWithType:(NSString *)type
                   answers:(NSArray *)answers
                locations:(NSArray *)locations
                completion:(void (^)(BOOL success, NSDictionary *response, NSError *error))completion {
    
    // 生成时间戳和加密值
    NSInteger timestamp = (NSInteger)[[NSDate date] timeIntervalSince1970];
    NSString *enc = [self generateEncryptedTimestamp:timestamp];
    
    // 构建请求数据
    NSDictionary *data = @{
        @"type": type,
        @"timestamp": @(timestamp),
        @"enc": enc,
        @"answers": answers,
        @"locations": locations
    };
    
    // 创建请求
    NSURL *url = [NSURL URLWithString:@"http://localhost:3000/api/submit"];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    request.HTTPMethod = @"POST";
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    
    // 转换数据为JSON
    NSError *jsonError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:data options:0 error:&jsonError];
    if (jsonError) {
        if (completion) {
            completion(NO, nil, jsonError);
        }
        return;
    }
    
    request.HTTPBody = jsonData;
    
    // 发送请求
    NSURLSession *session = [NSURLSession sharedSession];
    NSURLSessionDataTask *task = [session dataTaskWithRequest:request
                                          completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error) {
            if (completion) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    completion(NO, nil, error);
                });
            }
            return;
        }
        
        // 解析响应
        NSError *parseError;
        NSDictionary *responseDict = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
        
        if (parseError) {
            if (completion) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    completion(NO, nil, parseError);
                });
            }
            return;
        }
        
        // 检查响应状态
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        BOOL success = httpResponse.statusCode == 200;
        
        if (completion) {
            dispatch_async(dispatch_get_main_queue(), ^{
                completion(success, responseDict, nil);
            });
        }
    }];
    
    [task resume];
}

@end 