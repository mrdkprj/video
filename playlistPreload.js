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
                  "selectFile",
                  "clear",
                  "remove",
                  "reveal",
                  "playlist-context",
                  "changeOrder"
              ];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },

        receive: (channel, func) => {
            const validChannels = ["change-list","play","removed"];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender`
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }
    }
  );