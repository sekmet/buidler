export type AbortAnalytics = () => void;

type TaskKind = "builtin" | "custom";

export interface AnalyticsClient {
  sendTaskHit: (taskKind: TaskKind) => [AbortAnalytics, Promise<void>];
}
