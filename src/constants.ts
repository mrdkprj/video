
export const defaultConfig :Mp.Config = {
    bounds: {width:1200, height:800, x:0, y:0},
    playlistBounds: {width:400, height:700, x:0, y:0},
    isMaximized: false,
    playlistVisible:true,
    video:{
        playbackRate:1,
        seekSpeed:10,
        fitToWindow: true,
    },
    audio:{
        volume: 1,
        ampLevel: 0.07,
        mute:false,
    },
    path:{
        captureDestDir:"",
        convertDestDir:""
    }
}

export const videoFormats = [
    "mp4",
    "mov",
    "avi",
    "wmv",
    "webm",
    "flv"
]

export const audioFormats = [
    "wav",
    "mp3",
    "webm",
]

export const resolutions = {
    "Same": "",
    "360p":"480x360",
    "480p":"640x480",
    "720p":"1280x720",
    "1080p":"1920x1080",
}

export const rotations = {
    "None": -1,
    "90Clockwise": 1,
    "90CounterClockwise":2
}

export const EmptyFile:Mp.MediaFile = {
    id:"",
    fullPath:"",
    src:"",
    name:"",
    date: 0
}

export const CONFIG_FILE_NAME = "mediaplayer.config.json"
export const FORWARD = 1;
export const BACKWARD = -1
export const FIT_TO_WINDOW_ITEM_INDEX = 1;