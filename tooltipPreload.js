const {
    contextBridge,
    ipcRenderer
  } = require("electron");


  contextBridge.exposeInMainWorld(
    "api", {
        send: (channel, data) => {
            // whitelist channels
            const validChannels = [
                "content-set",
              ];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },

        receive: (channel, func) => {
            const validChannels = ["change-content"];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender`
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }
    }
  );