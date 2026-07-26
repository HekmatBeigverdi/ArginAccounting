import {
  BackgroundJobRegistry,
  BackgroundJobRunner,
  DefaultNotificationService,
  InMemoryBackgroundJobQueue,
  InMemoryEventBus,
  InMemoryNotificationStore,
  InMemoryPluginRegistry,
  SystemClock,
  UuidGenerator,
  type BackgroundJobHandler,
  type BackgroundJobQueue,
  type Clock,
  type EventBus,
  type IdGenerator,
  type NotificationService,
  type NotificationStore,
  type PluginDefinition,
  type PluginRegistry
} from "@argin/platform";

import {
  DesktopBackgroundWorker
} from "./desktop-background-worker";

export interface DesktopPlatformRegistration {
  readonly plugins?: readonly PluginDefinition[];

  readonly backgroundJobHandlers?:
    readonly BackgroundJobHandler[];
}

export interface DesktopPlatform {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly eventBus: EventBus;
  readonly pluginRegistry: PluginRegistry;
  readonly notificationStore:
    NotificationStore;
  readonly notificationService:
    NotificationService;
  readonly backgroundJobQueue:
    BackgroundJobQueue;
  readonly backgroundJobRegistry:
    BackgroundJobRegistry;
  readonly backgroundJobRunner:
    BackgroundJobRunner;
  readonly backgroundWorker:
    DesktopBackgroundWorker;

  start(): void;
  stop(): void;
}

export function createDesktopPlatform(
  registrations:
    readonly DesktopPlatformRegistration[] = []
): DesktopPlatform {
  const clock = new SystemClock();
  const idGenerator = new UuidGenerator();

  const eventBus =
    new InMemoryEventBus();

  const pluginRegistry =
    new InMemoryPluginRegistry();

  const notificationStore =
    new InMemoryNotificationStore();

  const notificationService =
    new DefaultNotificationService(
      notificationStore,
      {
        clock,
        idGenerator
      }
    );

  const backgroundJobQueue =
    new InMemoryBackgroundJobQueue();

  const backgroundJobRegistry =
    new BackgroundJobRegistry();

  for (const registration of registrations) {
    for (
      const plugin
      of registration.plugins ?? []
    ) {
      pluginRegistry.register(plugin);
    }
  }

  for (const registration of registrations) {
    for (
      const handler
      of registration.backgroundJobHandlers ??
        []
    ) {
      backgroundJobRegistry.register(handler);
    }
  }

  pluginRegistry.validateDependencies();

  const backgroundJobRunner =
    new BackgroundJobRunner(
      backgroundJobQueue,
      backgroundJobRegistry,
      clock
    );

  const backgroundWorker =
    new DesktopBackgroundWorker(
      backgroundJobRunner,
      {
        intervalMilliseconds: 1_000
      }
    );

  return Object.freeze({
    clock,
    idGenerator,
    eventBus,
    pluginRegistry,
    notificationStore,
    notificationService,
    backgroundJobQueue,
    backgroundJobRegistry,
    backgroundJobRunner,
    backgroundWorker,

    start(): void {
      backgroundWorker.start();
    },

    stop(): void {
      backgroundWorker.stop();
    }
  });
}
