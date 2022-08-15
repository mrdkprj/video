const builder = require("electron-builder");

builder.build({
    config: {
        "appId": "VidPlayer",
        "productName": "VidPlayer",
        "win":{
            "target": {
                "target": "nsis",
                "arch": [
                    "x64",
                    //"ia32",
                ]
            },
            "icon": "resources/icon.ico",
            "fileAssociations": [
                {
                  "ext": "mp4",
                  "icon": "resources/icon.ico",
                  "description": "Video File",
                },
                {
                    "ext": "mp3",
                    "icon": "resources/icon_audio.ico",
                    "description": "Audio File"
                }
            ],
        },
        "nsis": {
            "oneClick": true,
            "allowToChangeInstallationDirectory": false,
            "runAfterFinish": false,
        }
    }
});