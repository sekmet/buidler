import ci from "ci-info";
import debug from "debug";
import { keccak256 } from "ethereumjs-util";
import fs from "fs-extra";
import os from "os";
import path from "path";
import uuid from "uuid/v4";

import * as builtinTaskNames from "../../builtin-tasks/task-names";
import { ExecutionMode, getExecutionMode } from "../core/execution-mode";
import { getPackageJson } from "../util/packageInfo";

import { BugsnagClient } from "./bugsnag";
import { AbortAnalytics, AnalyticsClient } from "./client";
import { GoogleAnalytics } from "./google";
import { RollbarClient } from "./rollbar";

export type UserType = "CI" | "Developer";

export const NoOp = () => {};
export const NoOpAsync = () => Promise.resolve();

const log = debug("buidler:core:analytics");

export class Analytics {
  public static async getInstance(rootPath: string, enabled: boolean) {
    const [buidlerVersion, clientId] = await Promise.all([
      getBuidlerVersion(),
      getClientId()
    ]);

    const analytics: Analytics = new Analytics({
      projectId: getProjectId(rootPath),
      clientId,
      enabled,
      userType: getUserType(),
      userAgent: getUserAgent(),
      buidlerVersion
    });

    return analytics;
  }
  private readonly _clients: (AnalyticsClient)[];

  private readonly _enabled: boolean;

  private constructor({
    projectId,
    clientId,
    enabled,
    userType,
    userAgent,
    buidlerVersion
  }: {
    projectId: string;
    clientId: string;
    enabled: boolean;
    userType: UserType;
    userAgent: string;
    buidlerVersion: string;
  }) {
    this._enabled = enabled && !this._isLocalDev();

    const bugsnagClient = new BugsnagClient(
      projectId,
      clientId,
      userType,
      userAgent,
      buidlerVersion
    );

    const rollbarClient = new RollbarClient(
      projectId,
      clientId,
      userType,
      userAgent,
      buidlerVersion
    );

    const googleClient = new GoogleAnalytics(
      projectId,
      clientId,
      userType,
      userAgent,
      buidlerVersion
    );

    this._clients = [googleClient, rollbarClient, bugsnagClient];
  }

  /**
   * Attempt to send a hit to Google Analytics using the Measurement Protocol.
   * This function returns immediately after starting the request, returning a function for aborting it.
   * The idea is that we don't want Buidler tasks to be slowed down by a slow network request, so
   * Buidler can abort the request if it takes too much time.
   *
   * Trying to abort a successfully completed request is a no-op, so it's always safe to call it.
   *
   * @param taskName The name of the task to be logged
   *
   * @returns The abort function
   */
  public sendTaskHit(taskName: string): [AbortAnalytics, Promise<void>] {
    const taskKind = this._isABuiltinTaskName(taskName) ? "builtin" : "custom";

    if (!this._enabled) {
      return [NoOp, NoOpAsync()];
    }

    const sendTaskHits = this._clients
      .map(client => client.sendTaskHit(taskKind))
      .reduce(
        ({ abortAll, hitAll }, [abort, hitPromise]) => ({
          abortAll: [abort, ...abortAll],
          hitAll: [hitPromise, ...hitAll]
        }),
        { abortAll: [] as AbortAnalytics[], hitAll: [] as Array<Promise<void>> }
      );

    return [
      () => sendTaskHits.abortAll.forEach(abort => abort()),
      (async () => {
        await Promise.all(sendTaskHits.hitAll);
      })()
    ];
  }

  public async sendError(error: Error) {
    if (!this._enabled) {
      return NoOpAsync();
    }

    // send error report to all configured clients
    return Promise.all(
      this._clients.map(client => client.sendErrorReport(error))
    );
  }

  private _isABuiltinTaskName(taskName: string) {
    return Object.values<string>(builtinTaskNames).includes(taskName);
  }

  /**
   * Checks whether we're using Buidler in development mode (that is, we're working _on_ Buidler).
   * We don't want the tasks we run at these moments to be tracked, so we disable analytics if so.
   */
  private _isLocalDev(): boolean {
    const executionMode = getExecutionMode();

    return (
      executionMode === ExecutionMode.EXECUTION_MODE_LINKED ||
      executionMode === ExecutionMode.EXECUTION_MODE_TS_NODE_TESTS
    );
  }
}

async function getClientId() {
  const globalBuidlerConfigFile = path.join(
    os.homedir(),
    ".buidler",
    "config.json"
  );

  await fs.ensureFile(globalBuidlerConfigFile);

  let clientId;

  log(`Looking up Client Id at ${globalBuidlerConfigFile}`);
  try {
    const data = JSON.parse(await fs.readFile(globalBuidlerConfigFile, "utf8"));

    clientId = data.analytics.clientId;

    log(`Client Id found: ${clientId}`);
  } catch (e) {
    log("Client Id not found, generating a new one");
    clientId = uuid();

    await fs.writeFile(
      globalBuidlerConfigFile,
      JSON.stringify({
        analytics: {
          clientId
        }
      }),
      "utf-8"
    );

    log(`Successfully generated clientId ${clientId}`);
  }

  return clientId;
}

function getProjectId(rootPath: string) {
  log(`Computing Project Id for ${rootPath}`);

  const projectId = keccak256(rootPath).toString("hex");

  log(`Project Id set to ${projectId}`);
  return projectId;
}

function getUserType(): UserType {
  // ci-info hasn't released support for github actions yet, so we
  // test it manually here. See: https://github.com/watson/ci-info/issues/48
  return ci.isCI || process.env.GITHUB_ACTIONS !== undefined
    ? "CI"
    : "Developer";
}

/**
 * At the moment, we couldn't find a reliably way to report the OS () in Node,
 * as the versions reported by the various `os` APIs (`os.platform()`, `os.type()`, etc)
 * return values different to those expected by Google Analytics
 * We decided to take the compromise of just reporting the OS Platform (OSX/Linux/Windows) for now (version information is bogus for now).
 */
function getOperatingSystem(): string {
  switch (os.type()) {
    case "Windows_NT":
      return "(Windows NT 6.1; Win64; x64)";
    case "Darwin":
      return "(Macintosh; Intel Mac OS X 10_13_6)";
    case "Linux":
      return "(X11; Linux x86_64)";
    default:
      return "(Unknown)";
  }
}

function getUserAgent(): string {
  return `Node/${process.version} ${getOperatingSystem()}`;
}

async function getBuidlerVersion(): Promise<string> {
  const { version } = await getPackageJson();

  return `Buidler ${version}`;
}
