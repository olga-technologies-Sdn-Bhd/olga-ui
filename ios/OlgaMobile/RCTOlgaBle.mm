#import "RCTOlgaBle.h"

#import <CoreBluetooth/CoreBluetooth.h>
#import <Security/Security.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>

// Nearby over Bluetooth (src/bluetooth, src/nearby). While started, the phone
// advertises the Ol-ga service UUID, scans for it, and serves a GATT service
// with the same UUID:
//  - CARD (read): this phone's card, JSON, at most 512 bytes;
//  - INBOX (write): messages from other phones, in frames of
//    [message id, frame index, frame count, bytes...].
// As a client it reads other phones' cards and writes to their inboxes, one
// connection at a time, each with a timeout. It also posts local
// notifications, which need no internet.
//
// What is advertised: the 128-bit service UUID and, as the local name, an
// 8-byte random session token in 16 hex characters (iOS only lets apps
// advertise service UUIDs and a local name; Android phones put the token in
// service data instead, and scans here accept either). The token is new every
// time discovery starts.
//
// Foreground only: JS calls stop() when the app leaves the foreground, and
// the app declares no Bluetooth background mode. All state lives on _queue.

static const NSUInteger kTokenBytes = 8;
// Send each device to JS at most this often (RSSI updates arrive many times a second).
static const NSTimeInterval kSightingInterval = 1.0;
static const NSTimeInterval kOpTimeout = 12.0;
static const NSUInteger kFrameHeader = 3;
static const NSUInteger kMaxFrames = 255;
static NSString *const kCardUuid = @"3eecebab-22bf-4234-bf1d-035cbe8539f5";
static NSString *const kInboxUuid = @"3eecebab-22bf-4234-bf1d-035cbe8539f6";

static NSString *HexString(NSData *data)
{
  const unsigned char *bytes = (const unsigned char *)data.bytes;
  NSMutableString *hex = [NSMutableString stringWithCapacity:data.length * 2];
  for (NSUInteger i = 0; i < data.length; i++) {
    [hex appendFormat:@"%02x", bytes[i]];
  }
  return hex;
}

static BOOL IsTokenHex(NSString *value)
{
  if (value.length != kTokenBytes * 2) {
    return NO;
  }
  NSCharacterSet *invalid = [[NSCharacterSet characterSetWithCharactersInString:@"0123456789abcdef"] invertedSet];
  return [value rangeOfCharacterFromSet:invalid].location == NSNotFound;
}

static UIColor *ColorFromHex(NSString *hex, UIColor *fallback)
{
  NSString *clean = [hex stringByReplacingOccurrencesOfString:@"#" withString:@""];
  if (clean.length != 6) {
    return fallback;
  }
  unsigned int rgb = 0;
  if (![[NSScanner scannerWithString:clean] scanHexInt:&rgb]) {
    return fallback;
  }
  return [UIColor colorWithRed:((rgb >> 16) & 0xff) / 255.0 green:((rgb >> 8) & 0xff) / 255.0 blue:(rgb & 0xff) / 255.0 alpha:1];
}

// Notification taps. The delegate is installed when the class loads, before
// the app finishes launching, so a tap that cold-starts Ol-ga isn't lost. It
// keeps the tapped notification's id for consumeOpenedNotification and tells a
// running module straight away.
static NSString *const kOlgaNotificationOpened = @"OlgaNotificationOpened";
static NSString *gOpenedNotification = nil;

@interface OlgaNotificationDelegate : NSObject <UNUserNotificationCenterDelegate>
@end

@implementation OlgaNotificationDelegate

// Show Nearby notifications as banners even while Ol-ga is open (it is, for Nearby).
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler
{
  completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionList | UNNotificationPresentationOptionSound);
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
    didReceiveNotificationResponse:(UNNotificationResponse *)response
             withCompletionHandler:(void (^)(void))completionHandler
{
  NSString *identifier = response.notification.request.identifier;
  gOpenedNotification = identifier;
  [[NSNotificationCenter defaultCenter] postNotificationName:kOlgaNotificationOpened object:identifier];
  completionHandler();
}

@end

static OlgaNotificationDelegate *gNotificationDelegate = nil;

// One client operation: read a card (payload nil) or write a message.
@interface OlgaBleOp : NSObject
@property (nonatomic, strong) CBPeripheral *peripheral;
@property (nonatomic, strong, nullable) NSData *payload;
@property (nonatomic, copy) RCTPromiseResolveBlock resolve;
@property (nonatomic, copy) RCTPromiseRejectBlock reject;
@property (nonatomic, strong) NSArray<NSData *> *frames;
@property (nonatomic) NSUInteger frameIndex;
@property (nonatomic) BOOL done;
@end

@implementation OlgaBleOp
@end

@interface RCTOlgaBle () <CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate>
@end

@implementation RCTOlgaBle {
  dispatch_queue_t _queue;
  CBCentralManager *_central;
  CBPeripheralManager *_peripheral;
  CBUUID *_serviceUuid;
  NSString *_token;
  BOOL _advertising;
  BOOL _scanning;
  BOOL _serviceAdded;
  NSString *_error;
  NSData *_card;
  NSMutableDictionary<NSString *, NSDate *> *_lastSent;
  NSMutableDictionary<NSString *, CBPeripheral *> *_devices;
  NSMutableDictionary<NSString *, NSMutableArray *> *_partial;
  NSMutableArray<OlgaBleOp *> *_queueOps;
  OlgaBleOp *_current;
  uint8_t _nextMessageId;
}

+ (NSString *)moduleName
{
  return @"OlgaBle";
}

+ (void)load
{
  gNotificationDelegate = [OlgaNotificationDelegate new];
  [UNUserNotificationCenter currentNotificationCenter].delegate = gNotificationDelegate;
}

- (instancetype)init
{
  if (self = [super init]) {
    _queue = dispatch_queue_create("com.olga.connect.ble", DISPATCH_QUEUE_SERIAL);
    _error = @"";
    _card = [NSData data];
    _lastSent = [NSMutableDictionary new];
    _devices = [NSMutableDictionary new];
    _partial = [NSMutableDictionary new];
    _queueOps = [NSMutableArray new];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(notificationOpened:)
                                                 name:kOlgaNotificationOpened
                                               object:nil];
  }
  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

// A tap while Ol-ga is running: JS handles it now, so it isn't consumed again.
- (void)notificationOpened:(NSNotification *)note
{
  NSString *identifier = note.object;
  if (identifier == nil || !_eventEmitterCallback) {
    return;
  }
  gOpenedNotification = nil;
  dispatch_async(dispatch_get_main_queue(), ^{
    [self emitOnNotificationOpened:@{@"id" : identifier}];
  });
}

- (void)consumeOpenedNotification:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSString *identifier = gOpenedNotification ?: @"";
    gOpenedNotification = nil;
    resolve(identifier);
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeOlgaBleSpecJSI>(params);
}

- (void)invalidate
{
  dispatch_async(_queue, ^{
    [self stopOnQueue];
  });
}

#pragma mark - NativeOlgaBleSpec

- (void)start:(NSString *)serviceUuid
{
  dispatch_async(_queue, ^{
    if (self->_token != nil) {
      return; // already running: never two scans or two advertisements
    }
    NSUUID *parsed = [[NSUUID alloc] initWithUUIDString:serviceUuid];
    if (parsed == nil) {
      self->_error = @"Invalid service UUID";
      [self emitStatus];
      return;
    }
    self->_serviceUuid = [CBUUID UUIDWithNSUUID:parsed];
    self->_token = [self newToken];
    self->_error = @"";
    // Creating the managers shows the Bluetooth permission prompt the first
    // time; their delegates start scanning and serving once powered on.
    self->_central = [[CBCentralManager alloc] initWithDelegate:self
                                                          queue:self->_queue
                                                        options:@{CBCentralManagerOptionShowPowerAlertKey : @NO}];
    self->_peripheral = [[CBPeripheralManager alloc] initWithDelegate:self
                                                                queue:self->_queue
                                                              options:@{CBPeripheralManagerOptionShowPowerAlertKey : @NO}];
    [self emitStatus];
  });
}

- (void)stop
{
  dispatch_async(_queue, ^{
    [self stopOnQueue];
  });
}

- (void)getStatus:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(_queue, ^{
    resolve([self statusDictionary]);
  });
}

- (void)setCard:(NSString *)card
{
  NSData *data = [card dataUsingEncoding:NSUTF8StringEncoding] ?: [NSData data];
  dispatch_async(_queue, ^{
    self->_card = data;
  });
}

- (void)readCard:(NSString *)token resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(_queue, ^{
    [self enqueueFor:token payload:nil resolve:resolve reject:reject];
  });
}

- (void)sendMessage:(NSString *)token
            payload:(NSString *)payload
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  NSData *data = [payload dataUsingEncoding:NSUTF8StringEncoding] ?: [NSData data];
  dispatch_async(_queue, ^{
    [self enqueueFor:token payload:data resolve:resolve reject:reject];
  });
}

- (void)showNotification:(NSString *)id
                   title:(NSString *)title
                    body:(NSString *)body
                initials:(NSString *)initials
                   color:(NSString *)color
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
    UNMutableNotificationContent *content = [UNMutableNotificationContent new];
    content.title = title;
    content.body = body;
    content.sound = [UNNotificationSound defaultSound];
    NSURL *avatar = [self avatarFileWithInitials:initials color:color name:id];
    if (avatar != nil) {
      UNNotificationAttachment *attachment = [UNNotificationAttachment attachmentWithIdentifier:@"avatar" URL:avatar options:nil error:nil];
      if (attachment != nil) {
        content.attachments = @[ attachment ];
      }
    }
    UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:id content:content trigger:nil];
    [center addNotificationRequest:request withCompletionHandler:nil];
  });
}

- (void)requestNotificationPermission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
    [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
                          completionHandler:^(BOOL granted, NSError *_Nullable error) {
                            resolve(@(granted));
                          }];
  });
}

- (NSURL *)avatarFileWithInitials:(NSString *)initials color:(NSString *)color name:(NSString *)name
{
  CGFloat side = 128;
  UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:CGSizeMake(side, side)];
  UIImage *image = [renderer imageWithActions:^(UIGraphicsImageRendererContext *context) {
    [ColorFromHex(color, [UIColor colorWithWhite:0.92 alpha:1]) setFill];
    [[UIBezierPath bezierPathWithOvalInRect:CGRectMake(0, 0, side, side)] fill];
    NSString *text = initials.length > 2 ? [initials substringToIndex:2] : initials;
    NSDictionary *attributes = @{
      NSFontAttributeName : [UIFont systemFontOfSize:side * 0.38 weight:UIFontWeightSemibold],
      NSForegroundColorAttributeName : ColorFromHex(@"#1B2A41", [UIColor blackColor]),
    };
    CGSize size = [text sizeWithAttributes:attributes];
    [text drawAtPoint:CGPointMake((side - size.width) / 2, (side - size.height) / 2) withAttributes:attributes];
  }];
  NSData *png = UIImagePNGRepresentation(image);
  NSString *file = [NSString stringWithFormat:@"olga-avatar-%lu.png", (unsigned long)name.hash];
  NSURL *url = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:file]];
  return [png writeToURL:url atomically:YES] ? url : nil;
}

#pragma mark - Lifecycle

- (void)stopOnQueue
{
  if (_central.state == CBManagerStatePoweredOn && _scanning) {
    [_central stopScan];
  }
  if (_peripheral.state == CBManagerStatePoweredOn) {
    if (_advertising) {
      [_peripheral stopAdvertising];
    }
    [_peripheral removeAllServices];
  }
  [self failAllOps:@"Nearby stopped"];
  _central.delegate = nil;
  _peripheral.delegate = nil;
  _central = nil;
  _peripheral = nil;
  _scanning = NO;
  _advertising = NO;
  _serviceAdded = NO;
  _token = nil;
  _serviceUuid = nil;
  _error = @"";
  [_lastSent removeAllObjects];
  [_devices removeAllObjects];
  [_partial removeAllObjects];
  [self emitStatus];
}

- (NSString *)newToken
{
  uint8_t bytes[kTokenBytes];
  if (SecRandomCopyBytes(kSecRandomDefault, kTokenBytes, bytes) != errSecSuccess) {
    arc4random_buf(bytes, kTokenBytes);
  }
  return HexString([NSData dataWithBytes:bytes length:kTokenBytes]);
}

#pragma mark - CBCentralManagerDelegate (scanning and connecting)

- (void)centralManagerDidUpdateState:(CBCentralManager *)central
{
  if (central != _central) {
    return;
  }
  if (central.state == CBManagerStatePoweredOn) {
    if (!_scanning && _serviceUuid != nil) {
      // Duplicates on: each advertisement updates RSSI and last seen. Costs
      // more power, which is acceptable while the app is open and available.
      [central scanForPeripheralsWithServices:@[ _serviceUuid ]
                                      options:@{CBCentralManagerScanOptionAllowDuplicatesKey : @YES}];
      _scanning = YES;
    }
  } else {
    _scanning = NO; // the system stops scans when Bluetooth goes off
    [_lastSent removeAllObjects];
    [_devices removeAllObjects];
    [self failAllOps:@"Bluetooth is off"];
  }
  [self emitStatus];
}

- (void)centralManager:(CBCentralManager *)central
    didDiscoverPeripheral:(CBPeripheral *)peripheral
        advertisementData:(NSDictionary<NSString *, id> *)advertisementData
                     RSSI:(NSNumber *)RSSI
{
  if (central != _central || _serviceUuid == nil) {
    return;
  }
  NSInteger rssi = RSSI.integerValue;
  if (rssi == 127) {
    return; // RSSI unavailable
  }
  // Android phones send the token as service data; iPhones as the local name.
  NSString *other = nil;
  NSDictionary<CBUUID *, NSData *> *serviceData = advertisementData[CBAdvertisementDataServiceDataKey];
  NSData *data = serviceData[_serviceUuid];
  if (data.length == kTokenBytes) {
    other = HexString(data);
  } else {
    NSString *name = [advertisementData[CBAdvertisementDataLocalNameKey] lowercaseString];
    if (IsTokenHex(name)) {
      other = name;
    }
  }
  if (other == nil || [other isEqualToString:_token]) {
    return; // no scan response yet (the next callback will carry it), or ourselves
  }
  _devices[other] = peripheral;
  NSDate *now = [NSDate date];
  NSDate *last = _lastSent[other];
  if (last != nil && [now timeIntervalSinceDate:last] < kSightingInterval) {
    return;
  }
  _lastSent[other] = now;
  [self emit:^{
    [self emitOnSighting:@{
      @"token" : other,
      @"rssi" : @(rssi),
      @"seenAt" : @(floor(now.timeIntervalSince1970 * 1000)),
    }];
  }];
}

- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral
{
  if (_current == nil || _current.peripheral != peripheral || _serviceUuid == nil) {
    return;
  }
  [peripheral discoverServices:@[ _serviceUuid ]];
}

- (void)centralManager:(CBCentralManager *)central didFailToConnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
  if (_current != nil && _current.peripheral == peripheral) {
    [self finish:_current value:nil error:@"Couldn't connect"];
  }
}

- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
  if (_current != nil && _current.peripheral == peripheral) {
    [self finish:_current value:nil error:@"Disconnected"];
  }
}

#pragma mark - Client operations

- (void)enqueueFor:(NSString *)token payload:(NSData *)payload resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  CBPeripheral *peripheral = _devices[token];
  if (peripheral == nil || _central.state != CBManagerStatePoweredOn) {
    reject(@"NOT_NEARBY", @"That phone isn't nearby", nil);
    return;
  }
  OlgaBleOp *op = [OlgaBleOp new];
  op.peripheral = peripheral;
  op.payload = payload;
  op.resolve = resolve;
  op.reject = reject;
  [_queueOps addObject:op];
  [self pump];
}

- (void)pump
{
  if (_current != nil || _queueOps.count == 0) {
    return;
  }
  OlgaBleOp *op = _queueOps.firstObject;
  [_queueOps removeObjectAtIndex:0];
  _current = op;
  op.peripheral.delegate = self;
  [_central connectPeripheral:op.peripheral options:nil];
  __weak RCTOlgaBle *weakSelf = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kOpTimeout * NSEC_PER_SEC)), _queue, ^{
    [weakSelf finish:op value:nil error:@"Timed out"];
  });
}

- (void)finish:(OlgaBleOp *)op value:(NSString *)value error:(NSString *)error
{
  if (op.done) {
    return;
  }
  op.done = YES;
  if (op.peripheral.state != CBPeripheralStateDisconnected) {
    [_central cancelPeripheralConnection:op.peripheral];
  }
  if (error == nil) {
    op.resolve(value);
  } else {
    op.reject(@"BLE_FAILED", error, nil);
  }
  if (_current == op) {
    _current = nil;
  }
  dispatch_async(_queue, ^{
    [self pump];
  });
}

- (void)failAllOps:(NSString *)message
{
  NSArray<OlgaBleOp *> *waiting = [_queueOps copy];
  [_queueOps removeAllObjects];
  for (OlgaBleOp *op in waiting) {
    op.done = YES;
    op.reject(@"BLE_FAILED", message, nil);
  }
  if (_current != nil) {
    [self finish:_current value:nil error:message];
  }
}

- (NSArray<NSData *> *)framesFor:(NSData *)payload size:(NSUInteger)size
{
  NSUInteger chunk = MAX((NSUInteger)1, size);
  NSUInteger count = MAX((NSUInteger)1, (payload.length + chunk - 1) / chunk);
  uint8_t messageId = _nextMessageId++;
  NSMutableArray<NSData *> *frames = [NSMutableArray arrayWithCapacity:count];
  for (NSUInteger i = 0; i < count; i++) {
    NSUInteger start = i * chunk;
    NSUInteger length = MIN(chunk, payload.length - MIN(start, payload.length));
    NSMutableData *frame = [NSMutableData dataWithCapacity:kFrameHeader + length];
    uint8_t header[3] = {messageId, (uint8_t)i, (uint8_t)count};
    [frame appendBytes:header length:kFrameHeader];
    if (length > 0) {
      [frame appendData:[payload subdataWithRange:NSMakeRange(start, length)]];
    }
    [frames addObject:frame];
  }
  return frames;
}

#pragma mark - CBPeripheralDelegate (as a client)

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverServices:(NSError *)error
{
  OlgaBleOp *op = _current;
  if (op == nil || op.peripheral != peripheral) {
    return;
  }
  CBService *service = nil;
  for (CBService *s in peripheral.services) {
    if ([s.UUID isEqual:_serviceUuid]) {
      service = s;
    }
  }
  if (error != nil || service == nil) {
    [self finish:op value:nil error:@"Ol-ga service not found"];
    return;
  }
  CBUUID *wanted = [CBUUID UUIDWithString:op.payload == nil ? kCardUuid : kInboxUuid];
  [peripheral discoverCharacteristics:@[ wanted ] forService:service];
}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverCharacteristicsForService:(CBService *)service error:(NSError *)error
{
  OlgaBleOp *op = _current;
  if (op == nil || op.peripheral != peripheral) {
    return;
  }
  CBUUID *wanted = [CBUUID UUIDWithString:op.payload == nil ? kCardUuid : kInboxUuid];
  CBCharacteristic *characteristic = nil;
  for (CBCharacteristic *c in service.characteristics) {
    if ([c.UUID isEqual:wanted]) {
      characteristic = c;
    }
  }
  if (error != nil || characteristic == nil) {
    [self finish:op value:nil error:@"Characteristic not found"];
    return;
  }
  if (op.payload == nil) {
    [peripheral readValueForCharacteristic:characteristic];
    return;
  }
  NSUInteger room = [peripheral maximumWriteValueLengthForType:CBCharacteristicWriteWithResponse];
  op.frames = [self framesFor:op.payload size:room > kFrameHeader ? room - kFrameHeader : 17];
  if (op.frames.count > kMaxFrames) {
    [self finish:op value:nil error:@"Message too long"];
    return;
  }
  op.frameIndex = 0;
  [peripheral writeValue:op.frames[0] forCharacteristic:characteristic type:CBCharacteristicWriteWithResponse];
}

- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
  OlgaBleOp *op = _current;
  if (op == nil || op.peripheral != peripheral || op.payload != nil) {
    return;
  }
  if (error != nil) {
    [self finish:op value:nil error:@"Read failed"];
    return;
  }
  NSString *text = [[NSString alloc] initWithData:characteristic.value ?: [NSData data] encoding:NSUTF8StringEncoding];
  [self finish:op value:text ?: @"" error:nil];
}

- (void)peripheral:(CBPeripheral *)peripheral didWriteValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
  OlgaBleOp *op = _current;
  if (op == nil || op.peripheral != peripheral || op.payload == nil) {
    return;
  }
  if (error != nil) {
    [self finish:op value:nil error:@"Write failed"];
    return;
  }
  op.frameIndex += 1;
  if (op.frameIndex >= op.frames.count) {
    [self finish:op value:nil error:nil];
    return;
  }
  [peripheral writeValue:op.frames[op.frameIndex] forCharacteristic:characteristic type:CBCharacteristicWriteWithResponse];
}

#pragma mark - CBPeripheralManagerDelegate (advertising and serving)

- (void)peripheralManagerDidUpdateState:(CBPeripheralManager *)peripheral
{
  if (peripheral != _peripheral) {
    return;
  }
  if (peripheral.state == CBManagerStatePoweredOn) {
    if (!_serviceAdded && _serviceUuid != nil) {
      CBMutableCharacteristic *card = [[CBMutableCharacteristic alloc] initWithType:[CBUUID UUIDWithString:kCardUuid]
                                                                         properties:CBCharacteristicPropertyRead
                                                                              value:nil
                                                                        permissions:CBAttributePermissionsReadable];
      CBMutableCharacteristic *inbox = [[CBMutableCharacteristic alloc] initWithType:[CBUUID UUIDWithString:kInboxUuid]
                                                                          properties:CBCharacteristicPropertyWrite
                                                                               value:nil
                                                                         permissions:CBAttributePermissionsWriteable];
      CBMutableService *service = [[CBMutableService alloc] initWithType:_serviceUuid primary:YES];
      service.characteristics = @[ card, inbox ];
      _serviceAdded = YES;
      [peripheral addService:service]; // advertising starts once it's added
    }
  } else {
    _advertising = NO;
    _serviceAdded = NO;
  }
  [self emitStatus];
}

- (void)peripheralManager:(CBPeripheralManager *)peripheral didAddService:(CBService *)service error:(NSError *)error
{
  if (peripheral != _peripheral) {
    return;
  }
  if (error != nil) {
    _error = [NSString stringWithFormat:@"Couldn't open the Nearby service: %@", error.localizedDescription];
  }
  if (!peripheral.isAdvertising && _serviceUuid != nil && _token != nil) {
    [peripheral startAdvertising:@{
      CBAdvertisementDataServiceUUIDsKey : @[ _serviceUuid ],
      CBAdvertisementDataLocalNameKey : _token,
    }];
  }
  [self emitStatus];
}

- (void)peripheralManagerDidStartAdvertising:(CBPeripheralManager *)peripheral error:(NSError *)error
{
  if (peripheral != _peripheral) {
    return;
  }
  _advertising = error == nil;
  if (error != nil) {
    _error = [NSString stringWithFormat:@"Advertising failed: %@", error.localizedDescription];
  }
  [self emitStatus];
}

- (void)peripheralManager:(CBPeripheralManager *)peripheral didReceiveReadRequest:(CBATTRequest *)request
{
  if (![request.characteristic.UUID isEqual:[CBUUID UUIDWithString:kCardUuid]]) {
    [peripheral respondToRequest:request withResult:CBATTErrorRequestNotSupported];
    return;
  }
  NSData *value = _card;
  if (request.offset > value.length) {
    [peripheral respondToRequest:request withResult:CBATTErrorInvalidOffset];
    return;
  }
  request.value = [value subdataWithRange:NSMakeRange(request.offset, value.length - request.offset)];
  [peripheral respondToRequest:request withResult:CBATTErrorSuccess];
}

- (void)peripheralManager:(CBPeripheralManager *)peripheral didReceiveWriteRequests:(NSArray<CBATTRequest *> *)requests
{
  CBUUID *inboxUuid = [CBUUID UUIDWithString:kInboxUuid];
  for (CBATTRequest *request in requests) {
    if (![request.characteristic.UUID isEqual:inboxUuid] || request.offset != 0 || request.value.length < kFrameHeader) {
      [peripheral respondToRequest:requests.firstObject withResult:CBATTErrorInvalidAttributeValueLength];
      return;
    }
  }
  for (CBATTRequest *request in requests) {
    [self onFrame:request.value from:request.central.identifier.UUIDString];
  }
  [peripheral respondToRequest:requests.firstObject withResult:CBATTErrorSuccess];
}

- (void)onFrame:(NSData *)frame from:(NSString *)sender
{
  const uint8_t *bytes = (const uint8_t *)frame.bytes;
  uint8_t messageId = bytes[0];
  NSUInteger index = bytes[1];
  NSUInteger count = bytes[2];
  if (count == 0 || index >= count) {
    return;
  }
  NSString *key = [NSString stringWithFormat:@"%@/%u", sender, messageId];
  NSMutableArray *parts = _partial[key];
  if (parts == nil || parts.count != count) {
    parts = [NSMutableArray arrayWithCapacity:count];
    for (NSUInteger i = 0; i < count; i++) {
      [parts addObject:[NSNull null]];
    }
    _partial[key] = parts;
  }
  parts[index] = [frame subdataWithRange:NSMakeRange(kFrameHeader, frame.length - kFrameHeader)];
  for (id part in parts) {
    if (part == [NSNull null]) {
      return;
    }
  }
  [_partial removeObjectForKey:key];
  NSMutableData *whole = [NSMutableData data];
  for (NSData *part in parts) {
    [whole appendData:part];
  }
  NSString *payload = [[NSString alloc] initWithData:whole encoding:NSUTF8StringEncoding];
  if (payload == nil) {
    return;
  }
  [self emit:^{
    [self emitOnMessage:@{@"payload" : payload}];
  }];
}

#pragma mark - Status

- (NSString *)bluetoothState
{
  CBManagerAuthorization authorization = CBManager.authorization;
  if (authorization == CBManagerAuthorizationDenied || authorization == CBManagerAuthorizationRestricted) {
    return @"unauthorized";
  }
  if (_central == nil) {
    return @"unknown"; // not started; reading the state would need a manager
  }
  switch (_central.state) {
    case CBManagerStatePoweredOn:
      return @"on";
    case CBManagerStatePoweredOff:
      return @"off";
    case CBManagerStateUnauthorized:
      return @"unauthorized";
    case CBManagerStateUnsupported:
      return @"unsupported";
    default:
      return @"unknown";
  }
}

- (NSDictionary *)statusDictionary
{
  return @{
    @"bluetooth" : [self bluetoothState],
    @"advertising" : @(_advertising),
    @"scanning" : @(_scanning),
    @"error" : _error ?: @"",
    @"token" : _token ?: @"",
  };
}

- (void)emitStatus
{
  NSDictionary *status = [self statusDictionary];
  [self emit:^{
    [self emitOnStatus:status];
  }];
}

// The emitter isn't wired up until JS subscribes; nothing is lost because JS
// reads getStatus() after start().
- (void)emit:(void (^)(void))send
{
  if (_eventEmitterCallback) {
    send();
  }
}

@end
