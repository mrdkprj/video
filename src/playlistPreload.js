const {
    contextBridge,
    ipcRenderer
  } = require("electron");


  contextBridge.exposeInMainWorld(
    "api", {
        send: (channel, data) => {
            // whitelist channels
            const validChannels = [
                "close-playlist",
                "drop",
                "select-file",
                "clear",
                "remove",
                "reveal",
                "playlist-context",
                "change-order",
                "show-tooltip",
                "hide-tooltip",
                "reload",
              ];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },

        receive: (channel, func) => {
            const validChannels = ["change-list","play","removed", "reset"];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender`
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }
    }
  );