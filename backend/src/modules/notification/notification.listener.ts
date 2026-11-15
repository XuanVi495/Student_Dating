import { logger } from '../../shared/logger/logger.js';
import type { EventBus } from '../../shared/events/event-bus.js';
import {
  matchingEventBus,
  type MatchingEvents,
  type MatchCreatedEvent,
  type MatchCancelledEvent,
} from '../../shared/events/matching.events.js';
import {
  userEventBus,
  type UserEvents,
  type VerificationReviewedEvent,
} from '../../shared/events/user.events.js';
import {
  reportEventBus,
  type ReportReviewedEvent,
  type ReportSubmittedEvent,
} from '../../shared/events/report.events.js';
import {
  notificationService,
  type NotificationService,
} from './notification.service.js';

type NotificationListenerService = Pick<
  NotificationService,
  'notifyMatchCreated' | 'notifyMatchCancelled' | 'notifyVerificationReviewed'
> &
  Partial<Pick<NotificationService, 'notifyVerificationSubmitted'>>;

type ErrorReporter = (eventName: string, payload: unknown, error: unknown) => void;

const defaultReportError: ErrorReporter = (eventName, payload, error) => {
  logger.error(`[Notification Listener] Handle ${eventName} event failed`, {
    eventName,
    payload,
    error: error instanceof Error ? error.message : String(error),
  });
};

export function registerNotificationListener(
  matchingBus: EventBus<MatchingEvents> = matchingEventBus,
  userBusOrService?: EventBus<UserEvents> | NotificationListenerService,
  serviceArg?: NotificationListenerService | ErrorReporter,
  reportErrorArg?: ErrorReporter
): () => void {
  let userBus: EventBus<UserEvents> = userEventBus;
  let service: NotificationListenerService = notificationService;
  let reportError: ErrorReporter = defaultReportError;

  if (
    userBusOrService &&
    'subscribe' in userBusOrService &&
    typeof userBusOrService.subscribe === 'function'
  ) {
    userBus = userBusOrService as EventBus<UserEvents>;
    if (serviceArg && typeof serviceArg === 'object') {
      service = serviceArg as NotificationListenerService;
    }
    if (reportErrorArg) {
      reportError = reportErrorArg;
    }
  } else if (userBusOrService) {
    service = userBusOrService as NotificationListenerService;
    if (typeof serviceArg === 'function') {
      reportError = serviceArg as ErrorReporter;
    }
  }

  const unsubscribeCreated = matchingBus.subscribe(
    'matching.match-created',
    (event: MatchCreatedEvent) => {
      logger.info('[Notification Listener] Handle matching.match-created event', {
        action: 'matching.match-created',
        matchId: event.matchId
      });
      void service
        .notifyMatchCreated(event.matchId, event.studentAId, event.studentBId)
        .catch((error: unknown) => {
          reportError('matching.match-created', event, error);
        });
    }
  );

  const unsubscribeVerification = userBus.subscribe(
    'user.verification-reviewed',
    (event: VerificationReviewedEvent) => {
      logger.info('[Notification Listener] Handle user.verification-reviewed event', {
        action: 'user.verification-reviewed',
        userId: event.userId,
        status: event.status,
        rejectionReason: event.rejectionReason
      });
      void service
        .notifyVerificationReviewed(
          event.userId,
          event.status,
          event.rejectionReason
        )
        .catch((error: unknown) => {
          reportError('user.verification-reviewed', event, error);
        });
    }
  );

  const unsubscribeVerificationSubmitted = userBus.subscribe(
    'user.verification-submitted',
    (event) => {
      if (!service.notifyVerificationSubmitted) return;
      void service.notifyVerificationSubmitted(event.userId).catch((error: unknown) => {
        reportError('user.verification-submitted', event, error);
      });
    }
  );

  return () => {
    unsubscribeCreated();
    unsubscribeVerification();
    unsubscribeVerificationSubmitted();
  };
}

export function registerReportNotificationListener(
  reportBus = reportEventBus,
  service: Pick<
    NotificationService,
    'notifyReportSubmitted' | 'notifyReportReviewed'
  > = notificationService
): () => void {
  const unsubscribeSubmitted = reportBus.subscribe(
    'report.submitted',
    (event: ReportSubmittedEvent) => {
      void service.notifyReportSubmitted(event.reporterId).catch((error: unknown) => {
        defaultReportError('report.submitted', event, error);
      });
    }
  );
  const unsubscribeReviewed = reportBus.subscribe(
    'report.reviewed',
    (event: ReportReviewedEvent) => {
      void service.notifyReportReviewed(event.reporterId, event.status).catch(
        (error: unknown) => {
          defaultReportError('report.reviewed', event, error);
        }
      );
    }
  );

  return () => {
    unsubscribeSubmitted();
    unsubscribeReviewed();
  };
}

let unregisterNotificationListener: (() => void) | undefined;
let unregisterReportNotificationListener: (() => void) | undefined;

export function initializeNotificationModule(): void {
  if (unregisterNotificationListener) {
    return;
  }
  unregisterNotificationListener = registerNotificationListener();
  unregisterReportNotificationListener = registerReportNotificationListener();
}
