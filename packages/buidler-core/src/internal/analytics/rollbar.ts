import debug from "debug";
import os from "os";
import Rollbar from "rollbar";

import * as builtinTaskNames from "../../builtin-tasks/task-names";

import { NoOp, UserType } from "./analytics";
import { AbortAnalytics, AnalyticsClient } from "./client";

const ROLLBAR_TOKEN = "13583a9fea154aac987ae5dc4760693e";

const log = debug("buidler:core:analytics:rollbar");

export class RollbarClient extends AnalyticsClient {
  private _rollbar: Rollbar;

  constructor(
    projectId: string,
    clientId: string,
    userType: UserType,
    userAgent: string,
    buidlerVersion: string
  ) {
    super();
    this._rollbar = new Rollbar({
      accessToken: ROLLBAR_TOKEN,
      captureUncaught: true,
      captureUnhandledRejections: true
    });

    this._rollbar.configure({
      payload: {
        person: {
          id: clientId,
          type: userType
        },
        project: {
          id: projectId
        },
        device: {
          userAgent,
          os: os.type(),
          platform: os.platform(),
          release: os.release()
        },
        version: buidlerVersion,
        javascript: {
          code_version: buidlerVersion,
          source_map_enabled: true
        }
      }
    });
  }

  // public constructor
  public sendTaskHit(
    taskKind: "builtin" | "custom",
    taskName: string
  ): [AbortAnalytics, Promise<void>] {
    const taskHit = async () => {
      log("Sending task hit");
      this._rollbar.info(`Task hit: ${taskName} (type "${taskKind}")`, {
        task: { name: taskName, type: taskKind }
      });
      this._waitForSend();
      log("Task hit sent");
    };
    return [NoOp, taskHit()];
  }

  public async sendErrorReport(error: Error) {
    log("Sending error report...");
    this._rollbar.error(error, this._contextualizeError(error));
    await this._waitForSend();
    log("Error report sent succesfully");
  }

  private async _waitForSend() {
    return new Promise(r => this._rollbar.wait(r));
  }
}
