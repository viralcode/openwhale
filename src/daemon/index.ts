/**
 * Daemon module exports
 */

export {
    OpenWhaleDaemon,
    startDaemon,
    stopDaemon,
    getDaemonStatus,
    type DaemonConfig,
    type DaemonStatus,
    type DaemonMessage,
    type DaemonResponse,
} from "./daemon.js";

export {
    installLaunchAgent,
    uninstallLaunchAgent,
    isLaunchAgentInstalled,
    isLaunchAgentLoaded,
    restartLaunchAgent,
    getLaunchAgentStatus,
    type LaunchAgentConfig,
} from "./launchd.js";
