export type AbortAnalytics = () => void;

export type TaskKind = "builtin" | "custom";

export interface AnalyticsClient {
  sendTaskHit(taskKind: TaskKind): [AbortAnalytics, Promise<void>];

  sendErrorReport(error: Error): Promise<void>;
}
