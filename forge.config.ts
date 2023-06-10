import type { ForgeConfig } from "@electron-forge/shared-types";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";
import fs from "fs/promises"
import path from "path"

const config: ForgeConfig = {
  plugins: [
      new WebpackPlugin({
        mainConfig,
        renderer: {
          config: rendererConfig,
          entryPoints: [
            {
              html: "./src/renderer/main/main.html",
              js: "./src/renderer/main/main.ts",
              name: "main_window",
              preload: {
                js: "./src/renderer/main/mainPreload.ts",
              },
            },
            {
              html: "./src/renderer/playlist/playlist.html",
              js: "./src/renderer/playlist/playlist.ts",
              name: "playlist_window",
              preload: {
                js: "./src/renderer/playlist/playlistPreload.ts",
              },
            },
            {
              html: "./src/renderer/tooltip/tooltip.html",
              js: "./src/renderer/tooltip/tooltip.ts",
              name: "tooltip_window",
              preload: {
                js: "./src/renderer/tooltip/tooltipPreload.ts",
              },
            },
            {
              html: "./src/renderer/convert/convert.html",
              js: "./src/renderer/convert/convert.ts",
              name: "convert_window",
              preload: {
                js: "./src/renderer/convert/convertPreload.ts",
              },
            },
          ],
        },
      }),
  ],
  hooks: {
    postPackage: async (_forgeConfig: any, packageResult: any) => {
        // remove out folder produced by Electron Forge
        fs.rm(path.join(packageResult.outputPaths[0], ".."), {recursive:true})
    }
  }
};

export default config;
