import { IpcMainEvent } from "electron";

declare global {

    interface Window {
        api: Api;
    }

    type MainChannel = "minimize" | "toggle-maximize" | "close" | "drop" | "load-file" | "progress" | "open-main-context" |
                        "played" | "paused" | "reload" | "save-image" | "close-playlist" | "file-released" |
                        "remove-playlist-item" | "open-playlist-context" | "change-playlist-order" | "prepare-tooltip" | "show-tooltip" | "hide-tooltip" |
                        "toggle-play" | "toggle-shuffle" | "toggle-fullscreen" |"close-convert" | "request-convert" |
                        "open-convert-sourcefile-dialog" | "request-cancel-convert" |
                        "rename-file" | "before-rename"

    type MainRendererChannel = "ready" | "on-file-load" | "toggle-play" | "change-display-mode" | "reset" | "error" | "release-file" | "log" |
                                "after-toggle-maximize" | "toggle-convert" | "change-playback-rate" | "change-seek-speed" | "before-convert"
                                "before-rename"
    type PlaylistRendererChannel = "after-drop"| "on-file-load" | "after-remove-playlist" | "reset" | "after-sort" | "after-rename" | "clear-playlist";
    type TooltipRendererChannel = "prepare-tooltip";
    type ConvertRendererChannel = "before-open" |"after-sourcefile-select" | "after-convert" | "after-sourcefile-select"

    type RendererChannel = MainRendererChannel | PlaylistRendererChannel | TooltipRendererChannel | ConvertRendererChannel
    type RendererName = "Main" | "Playlist" | "Tooltip" | "Convert"
    type Renderer = {[key in RendererName] : Electron.BrowserWindow}

    interface IpcMainHandler {
        channel: MainChannel;
        handle: handler;
    }

    type handler<T extends Mp.Args> = (event: IpcMainEvent, data?:T) => (void | Promise<void>)

    interface Api {
        send: <T extends Mp.Args>(channel: MainChannel, data?:T) => void;
        receive: <T extends Mp.Args>(channel:MainRendererChannel | PlaylistRendererChannel | TooltipRendererChannel | ConvertRendererChannel, listener: (data?: T) => void) => () => void;
    }

    type ThumbButtonType = "Play" | "Pause" | "Previous" | "Next"
    type MainContextMenuType = "PlaybackRate" | "SeekSpeed" | "OpenPlaylist" | "FitToWindow" | "Convert"
    type PlaylistContextMenuType = "Remove" | "RemoveAll" | "Trash" | "CopyFileName" | "Reveal" | SortType
    type SortType = "NameAsc" | "NameDesc" | "DateAsc" | "DateDesc"

    const MAIN_WINDOW_WEBPACK_ENTRY: string;
    const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const PLAYLIST_WINDOW_WEBPACK_ENTRY: string;
    const PLAYLIST_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const TOOLTIP_WINDOW_WEBPACK_ENTRY: string;
    const TOOLTIP_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const CONVERT_WINDOW_WEBPACK_ENTRY: string;
    const CONVERT_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

    namespace Mp {

        type VideoFrameSize = "Same" | "360p" | "480p" | "720p" | "1080p";
        type VideoRotation = "90Clockwise" | "90CounterClockwise" | "None"

        type Bounds = {
            width:number;
            height:number;
            x:number;
            y:number;
        }

        type Position ={
            x:number;
            y:number;
        }

        type Config = {
            bounds: Bounds;
            playlistBounds:Bounds;
            isMaximized:boolean;
            playlistVisible:boolean;
            video:{
                fitToWindow:boolean;
                playbackRate:number;
                seekSpeed:number;
            };
            audio:{
                volume:number;
                ampLevel:number;
                mute:boolean;
            };
            path:{
                captureDestDir:string;
                convertDestDir:string;
            }
        }

        type OnReady = {
            config:Config;
        }

        type MediaFile = {
            id:string;
            fullPath:string;
            src:string;
            name:string;
            date:number;
        }

        type MediaState = {
            mute: boolean;
            fitToWindow: boolean;
            videoDuration: number;
            videoVolume: number;
            ampLevel: number;
            gainNode: GainNode;
            playbackRate:number;
            seekSpeed:number;
        }

        type ChangePlaySpeedRequest = {
            playbackRate?:number;
            seekSpeed?:number;
        }

        type Slider = {
            slider:HTMLElement;
            track:HTMLElement;
            thumb:HTMLElement;
            rect:DOMRect;
            trackValue?:any;
            handler: (progress:number) => void;
        }

        type Sliders = {
            Time:Mp.Slider,
            Volume:Mp.Slider,
            Amp:Mp.Slider
        }

        type SliderState = {
            sliding:boolean;
            startX:number;
            slider:Slider;
        }

        type PlaylistDragState = {
            dragging: boolean,
            startElement:HTMLElement,
            startIndex: number,
            working:boolean,
        }

        type DropRequest = {
            files:string[];
            renderer:RendererName;
        }

        type DropResult = {
            files:MediaFile[];
        }

        type OnProgress = {
            progress:number;
        }

        type LoadFileRequest = {
            index:number;
            isAbsolute:boolean;
        }

        type ChangePlayStatusRequest = {
            played:boolean;
        }

        type OnFileLoad = {
            currentFile:MediaFile;
            autoPlay:boolean;
            startAt?:number;
        }

        type SaveImageRequet = {
            data:string;
            timestamp:number;
        }

        type CloseRequest = {
            mediaState:MediaState
        }

        type OpenPlaylistContextRequest = {
            fileIds:string[]
        }

        type ChangePlaylistOrderRequet = {
            start:number;
            end:number;
            currentIndex:number;
        }

        type RemovePlaylistItemRequest = {
            fileIds:string[]
        }

        type RemovePlaylistResult = {
            removedFileIds:string[]
        }

        type ReleaseFileRequest = {
            fileIds:string[];
        }

        type RenameRequest = {
            fileId:string;
        }

        type BeforeRename = {
            fileId:string;
            currentTime:number;
        }

        type RenameResult = {
            file:MediaFile;
        }

        type SortResult = {
            fileIds:string[]
        }

        type PrepareTooltipRequest = {
            fileName:string;
            position:Position;
        }

        type ShowTooltipRequest = {
            width:number;
            height:number;
            position:Position;
        }

        type ConvertRequest = {
            sourcePath:string;
            video:boolean;
            options:ConvertOptions;
        }

        type ConvertOptions = {
            frameSize?:VideoFrameSize;
            bitrate?:string;
            rotation?:VideoRotation;
        }

        type ConvertResult = {
            success:boolean;
            message?:string;
        }

        type FileSelectResult = {
            fullPath:string;
        }

        type ConfigChanged = {
            config:Config;
        }

        type ErrorArgs = {
            message:string;
        }

        type Logging = {
            log:any;
        }

        type Args = OnReady | OnFileLoad | DropRequest | OnProgress | LoadFileRequest | SaveImageRequet | CloseRequest | ChangePlaylistOrderRequet |
                    DropResult | RemovePlaylistResult | SortResult | PrepareTooltipRequest | ShowTooltipRequest | OpenPlaylistContextRequest | ChangePlaySpeedRequest |
                    ConvertRequest | FileSelectResult | RenameRequest | BeforeRename |RenameResult | ReleaseFileRequest | ConvertResult | ChangePlayStatusRequest |
                    ConfigChanged | ErrorArgs | Logging

    }

}
