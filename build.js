const builder = require("electron-builder");

builder.build({
    config: {
        "appId": "VidPlayerer",
        "win":{
            "target": {
                "target": "dir",
                "arch": [
                    "x64",
                    //"ia32",
                ]
            },
            "icon": "resources/icon.ico",
            "fileAssociations": [
                {
                  // 拡張子
                  "ext": ["mp4"],
                  // ファイルの種類
                  "description": "Video files",
                },
            ],
        }
    }
});