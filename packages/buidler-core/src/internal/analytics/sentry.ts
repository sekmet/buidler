import * as Sentry from "@sentry/node";
import debug from "debug";
import os from "os";

import { NoOp, UserType } from "./analytics";
import { AbortAnalytics, AnalyticsClient } from "./client";

const SENTRY_DSN =
  "https://08e9ea013b3f45cd87f6047ac0693ca2@o385006.ingest.sentry.io/5221401";

const log = debug("buidler:core:analytics:sentry");

export class SentryClient extends AnalyticsClient {
  public static SENTRY_FLUSH_TIMEOUT = 3000;
  constructor(
    projectId: string,
    clientId: string,
    userType: UserType,
    userAgent: string,
    buidlerVersion: string
  ) {
    super();

    // init bugsnag client
    Sentry.init({ dsn: SENTRY_DSN });

    // setup metadata to be included in all reports by default
    Sentry.configureScope(scope => {
      scope.setUser({ id: clientId, type: userType });
      scope.setTag("projectId", projectId);
      scope.setTag("version", buidlerVersion);
      scope.setTag("os", os.type());
      scope.setTag("node", process.version);
      scope.setTag("userAgent", userAgent);
      scope.setExtra("platform", os.platform());
      scope.setExtra("os release", os.release());
    });

    log("Sentry client init");
  }

  public sendTaskHit(
    taskKind: "builtin" | "custom",
    name: string
  ): [AbortAnalytics, Promise<void>] {
    log("Sending task hit...");

    Sentry.withScope(function(scope) {
      scope.setTag("name", name);
      scope.setTag("taskKind", taskKind);

      Sentry.captureMessage(`Task hit: '${name}' (kind: ${taskKind})`);
    });

    const logHitPromise = async () => {
      await Sentry.flush(SentryClient.SENTRY_FLUSH_TIMEOUT);
      log("Task hit sent");
    };

    return [NoOp, logHitPromise()];
  }

  public async sendErrorReport(error: Error): Promise<void> {
    log("Sending error report...");
    const errorContextData = super._contextualizeError(error);

    const {
      errorType,
      pluginName,
      title,
      description,
      name,
      number,
      message,
      category,
      contextMessage
    } = errorContextData;

    Sentry.withScope(function(scope) {
      scope.setTag("errorType", errorType);
      scope.setExtra("message", message);
      if (pluginName !== undefined) {
        scope.setTag("pluginName", pluginName);
      }
      if (name !== undefined) {
        scope.setTag("name", name);
      }
      if (number !== undefined) {
        scope.setTag("number", String(number));
      }
      if (title !== undefined) {
        scope.setExtra("title", title);
      }
      if (contextMessage !== undefined) {
        scope.setExtra("contextMessage", contextMessage);
      }
      if (category !== undefined) {
        scope.setTag("category.name", category.name);
        scope.setExtra("category.title", category.title);
      }
      if (description !== undefined) {
        scope.setExtra("description", description);
      }

      Sentry.captureException(error);
    });
    await Sentry.flush(SentryClient.SENTRY_FLUSH_TIMEOUT);
    log(`Successfully sent report: '${message}'`);
  }
}
