#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SWTrackingAPI : NSObject

// 生成加密时间戳
+ (NSString *)generateEncryptedTimestamp:(NSInteger)timestamp;

// 提交数据
+ (void)submitDataWithType:(NSString *)type
                   answers:(NSArray *)answers
                locations:(NSArray *)locations
                completion:(void (^)(BOOL success, NSDictionary * _Nullable response, NSError * _Nullable error))completion;

@end

NS_ASSUME_NONNULL_END 