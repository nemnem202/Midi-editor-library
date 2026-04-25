/** biome-ignore-all lint/suspicious/noExplicitAny: Intentional */

type LogLevel = "info" | "success" | "warn" | "error" | "draw";

const colors = {
  info: "#057cc9",
  success: "#419210",
  warn: "#fdaf13",
  error: "#c70d18",
  draw: "#c96e05",
};

const formatLog = (level: LogLevel, message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  return [
    `%c[${level.toUpperCase()}] %c${timestamp} %c${message}`,
    `color: ${colors[level]}; font-weight: bold`,
    `color: gray; font-size: 10px`,
    `color: inherit`,
  ];
};

export const logger = {
  info: (msg: string, ...args: any[]) => {
    console.log(...formatLog("info", msg), ...args);
  },
  success: (msg: string, ...args: any[]) => {
    console.log(...formatLog("success", msg), ...args);
  },
  warn: (msg: string, ...args: any[]) => {
    console.warn(...formatLog("warn", msg), ...args);
  },
  draw: (msg: string, ...args: any[]) => {
    console.log(...formatLog("draw", msg), ...args);
  },
  error: (msg: string, ...args: any[]) => {
    console.error(...formatLog("error", msg), ...args);
  },
  table: (data: any, msg?: string) => {
    if (msg) console.log(...formatLog("info", msg));
    console.table(data);
  },
};
