const {
  contextBridge,
  ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
  "api", {
      send: (channel, data) => {

          const validChannels = [
                "minimize",
                "toggle-maximize",
                "close",
                "drop",
                "change-index",
                "progress",
                "main-context",
                "played",
                "paused",
                "reload",
            ];
          if (validChannels.includes(channel)) {
              ipcRenderer.send(channel, data);
          }
      },

      receive: (channel, func) => {
          const validChannels = ["config", "play","toggle-play", "change-size-mode", "reset", "error", "release-file","log"];
          if (validChannels.includes(channel)) {
              ipcRenderer.on(channel, (event, ...args) => func(...args));
          }
      }
  }
);