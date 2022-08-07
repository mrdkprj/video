const {
  contextBridge,
  ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
  "api", {
      send: (channel, data) => {

          const validChannels = [
                "minimize",
                "toggleMaximize",
                "close",
                "openPlaylist",
                "drop",
                "changeIndex",
                "progress",
                "main-context",
                "toggle-thumb",
            ];
          if (validChannels.includes(channel)) {
              ipcRenderer.send(channel, data);
          }
      },

      receive: (channel, func) => {
          const validChannels = ["config", "play","toggle-play", "error", "clear-current","log"];
          if (validChannels.includes(channel)) {
              ipcRenderer.on(channel, (event, ...args) => func(...args));
          }
      }
  }
);