import Bugsnag, { Event as BugsnagEvent, OnErrorCallback } from "@bugsnag/js";
import debug from "debug";
import os from "os";

import { BuidlerError, BuidlerPluginError } from "../core/errors";
import { REVERSE_ERRORS_MAP } from "../core/errors-list";

import { NoOp, NoOpAsync, UserType } from "./analytics";
import { AbortAnalytics, AnalyticsClient, TaskKind } from "./client";

const BUGSNAG_API_KEY = "0d1affee077c44232592a0b985b2dca5";

const log = debug("buidler:core:analytics:bugsnag");

interface ErrorContextData {
  errorType: "BuidlerError" | "BuidlerPluginError" | "Error";
  isBuidlerError: boolean;

  pluginName?: string;
  title?: string;
  name?: string;
  number?: number;
  message?: string;
  category?: {
    title: string;
    name: string;
    min: number;
    max: number;
  };
}

export class BugsnagClient implements AnalyticsClient {
  constructor(
    projectId: string,
    clientId: string,
    userType: UserType,
    userAgent: string,
    buidlerVersion: string
  ) {
    // setup metadata to be included in all reports by default
    // each entry is displayed as a tab in the Bugsnag dashboard
    const metadata = {
      user: {
        type: userType
      },
      device: {
        userAgent,
        os: os.type(),
        platform: os.platform(),
        release: os.release()
      },
      project: {
        id: projectId
      }
    };

    // delegate bugsnag internal logs to "debug" module
    const customLogger = {
      debug: log.extend("debug"),
      info: log.extend("info"),
      warn: log.extend("warn"),
      error: log.extend("error")
    };

    // init bugsnag client
    Bugsnag.start({
      apiKey: BUGSNAG_API_KEY,
      appVersion: buidlerVersion,
      user: {
        // this property is useful to determine the unique users affected by a particular error
        id: clientId
      },
      metadata,
      logger: customLogger
    });

    log("Bugsnag client init");
  }

  public sendTaskHit(_: TaskKind) {
    return [NoOp, NoOpAsync()] as [AbortAnalytics, Promise<void>];
  }

  public async sendErrorReport(error: Error) {
    log("Sending error report...");
    const contextData = this._contextualizeError(error);

    try {
      const event = await this._bugsnagNotifyAsync(
        error,
        (_event: BugsnagEvent) => {
          _event.addMetadata("context", contextData);
        }
      );
      log(`Successfully sent report: '${event.errors[0].errorMessage}'`);
    } catch (error) {
      log(`Failed to report error, reason: ${error.message || error}`);
    }
  }

  private _contextualizeError(error: Error): ErrorContextData {
    const _isBuidlerError = BuidlerError.isBuidlerError(error);
    const _isBuidlerPluginError = BuidlerPluginError.isBuidlerPluginError(
      error
    );

    const isBuidlerError = _isBuidlerError || _isBuidlerPluginError;
    const errorType = _isBuidlerError
      ? "BuidlerError"
      : _isBuidlerPluginError
      ? "BuidlerPluginError"
      : "Error";

    let errorInfo = {};
    if (_isBuidlerPluginError) {
      const { pluginName } = error as BuidlerPluginError;
      errorInfo = {
        pluginName
      };
    } else if (_isBuidlerError) {
      const buidlerError = error as BuidlerError;
      const { number, message } = buidlerError;
      const errorData = REVERSE_ERRORS_MAP[number];
      const { category, name, title } = errorData;
      errorInfo = {
        number,
        message,
        category,
        name,
        title
      };
    }

    return {
      errorType,
      isBuidlerError,
      ...errorInfo
    };
  }

  /**
   * Async version of Bugsnag.notify() method.
   * Resolves to the Bugsnag.Event object if successful, or an error if failed.
   *
   * @param error - the error object to be sent
   * @param onError - callback used to add or amend data sent to Bugsnag dashboard. Also can cancel the event if this returns false.
   * @private
   */
  private _bugsnagNotifyAsync(error: Error, onError?: OnErrorCallback) {
    return new Promise<BugsnagEvent>((resolve, reject) =>
      Bugsnag.notify(error, onError, (reportError, reportEvent: BugsnagEvent) =>
        reportError ? reject(reportError) : resolve(reportEvent)
      )
    );
  }
}
