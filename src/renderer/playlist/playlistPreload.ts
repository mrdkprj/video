import {contextBridge, ipcRenderer} from "electron";

contextBridge.exposeInMainWorld(
    "api", {
        send: (channel:MainChannel, data:any) => {
            ipcRenderer.send(channel, data);
        },

        receive: (channel:PlaylistRendererChannel, listener:(data?: any) => void) => {
            ipcRenderer.on(channel, (event, ...args) => listener(...args));
        }
  }
);