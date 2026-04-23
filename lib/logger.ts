const SHOULD_LOG = false;

type LogLevel = "info" | "success" | "warn" | "error" | "draw";

const colors = {
	info: "#057cc9",
	draw: "#c96e05",
	success: "#419210",
	warn: "#fdaf13",
	error: "#c70d18",
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
		SHOULD_LOG && console.log(...formatLog("info", msg), ...args);
	},
	draw: (msg: string, ...args: any[]) => {
		SHOULD_LOG && console.log(...formatLog("draw", msg), ...args);
	},
	success: (msg: string, ...args: any[]) => {
		SHOULD_LOG && console.log(...formatLog("success", msg), ...args);
	},
	warn: (msg: string, ...args: any[]) => {
		SHOULD_LOG && console.warn(...formatLog("warn", msg), ...args);
	},
	error: (msg: string, ...args: any[]) => {
		SHOULD_LOG && console.error(...formatLog("error", msg), ...args);
	},
};
