import { BuidlerError, BuidlerPluginError } from "../core/errors";
import { REVERSE_ERRORS_MAP } from "../core/errors-list";

export type AbortAnalytics = () => void;

export type TaskKind = "builtin" | "custom";

interface ErrorContextData {
  errorType: "BuidlerError" | "BuidlerPluginError" | "Error";
  // true if is originated from Buidler, false otherwise
  isBuidlerError: boolean;
  // the base Error object message
  message: string;

  // the buidler plugin name (only if is BuidlerPluginError)
  pluginName?: string;

  /* the following are only available if is BuidlerError */
  // error code number
  number?: number;
  // error category info
  category?: {
    // category key name
    name: string;
    // category readable description
    title: string;
    // min error number in category range (inclusive)
    min: number;
    // max error number in category range (inclusive)
    max: number;
  };

  // error key name
  name?: string;
  // error contextualized message (after processing the ErrorDescriptor message template)
  contextMessage?: string;
  // error title (may be Markdown)
  title?: string;
  // error description (may be Markdown)
  description?: string;
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

    const { message } = error;

    let errorInfo = {};
    if (_isBuidlerPluginError) {
      const { pluginName } = error as BuidlerPluginError;
      errorInfo = {
        pluginName
      };
    } else if (_isBuidlerError) {
      const buidlerError = error as BuidlerError;

      // error specific/contextualized info
      const {
        number,
        errorDescriptor: { message: contextMessage, description, title }
      } = buidlerError;

      // general buidler error info
      const errorData = REVERSE_ERRORS_MAP[number];
      const { category, name } = errorData;
      errorInfo = {
        number,
        contextMessage,
        description,
        category,
        name,
        title
      };
    }

    return {
      errorType,
      isBuidlerError,
      message,
      ...errorInfo
    };
  }
}
