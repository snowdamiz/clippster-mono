#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface GraphBridge : NSObject

+ (int64_t)ticksPerSecond;
+ (NSString *)capabilitiesJSON;
+ (nullable NSString *)parseAndEvaluate:(NSString *)sceneJSON
                                   tick:(int64_t)tick
                            previewMode:(BOOL)previewMode
                                  error:(NSError * _Nullable * _Nullable)error;

@end

NS_ASSUME_NONNULL_END
