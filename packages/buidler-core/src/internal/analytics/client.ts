import { BuidlerError, BuidlerPluginError } from "../core/errors";
import { REVERSE_ERRORS_MAP } from "../core/errors-list";

export type AbortAnalytics = () => void;

export type TaskKind = "builtin" | "custom";

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

export abstract class AnalyticsClient {
  public abstract sendTaskHit(
    taskKind: TaskKind,
    name: string
  ): [AbortAnalytics, Promise<void>];

  public abstract sendErrorReport(error: Error): Promise<void>;

  protected _contextualizeError(error: Error): ErrorContextData {
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
}
