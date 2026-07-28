import { UuidGenerator } from "../common/index.ts";

export interface NotificationClock {
  now(): Date;
}

export interface NotificationIdGenerator {
  generate(): string;
}

export class SystemNotificationClock
  implements NotificationClock {
  now(): Date {
    return new Date();
  }
}

export class UuidNotificationIdGenerator
  extends UuidGenerator
  implements NotificationIdGenerator {}
