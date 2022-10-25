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
            "icon": "src/resources/icon.ico",
            "fileAssociations": [
                {
                  "ext": "mp4",
                  "icon": "src/resources/icon.ico",
                  "description": "Video File",
                },
                {
                    "ext": "mp3",
                    "icon": "src/resources/icon_audio.ico",
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