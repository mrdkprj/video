import ffmpeg from "fluent-ffmpeg"

declare global {

    interface Window {
        api: Api;
    }

    type RendererName = "Player" | "Playlist" | "Convert"
    type Renderer = {[key in RendererName] : Electron.BrowserWindow | undefined}

    type MainChannelEventMap = {
        "minimize": Mp.Event;
        "toggle-maximize": Mp.Event;
        "close": Mp.CloseRequest;
        "drop": Mp.DropRequest;
        "load-file": Mp.LoadFileRequest;
        "progress": Mp.ProgressEvent;
        "open-main-context": Mp.Event;
        "play-status-change": Mp.ChangePlayStatusRequest;
        "reload": Mp.Event;
        "save-image": Mp.SaveImageRequet;
        "close-playlist": Mp.Event;
        "file-released": Mp.Event;
        "remove-playlist-item": Mp.Event;
        "open-playlist-context": Mp.Event;
        "change-playlist-order": Mp.ChangePlaylistOrderRequet;
        "toggle-play": Mp.Event;
        "toggle-shuffle": Mp.Event;
        "toggle-fullscreen": Mp.FullscreenChange;
        "close-convert": Mp.Event;
        "request-convert": Mp.ConvertRequest;
        "open-convert-sourcefile-dialog": Mp.OpenFileDialogRequest;
        "request-cancel-convert": Mp.Event;
        "rename-file": Mp.RenameRequest;
        "playlist-item-selection-change": Mp.PlaylistItemSelectionChange;
    }

    type RendererChannelEventMap = {
        "ready": Mp.ReadyEvent;
        "after-file-load": Mp.FileLoadEvent;
        "toggle-play": Mp.Event;
        "toggle-fullscreen": Mp.Event;
        "change-display-mode": Mp.ConfigChangeEvent;
        "restart": Mp.Event;
        "release-file": Mp.ReleaseFileRequest;
        "log": Mp.Logging;
        "after-toggle-maximize": Mp.ConfigChangeEvent;
        "toggle-convert": Mp.Event;
        "change-playback-rate": Mp.ChangePlaybackRateRequest;
        "change-seek-speed": Mp.ChangeSeekSpeedRequest;
        "playlist-change": Mp.PlaylistChangeEvent;
        "after-remove-playlist": Mp.RemovePlaylistItemResult;
        "after-sort": Mp.SortResult;
        "after-rename": Mp.RenameResult;
        "after-sourcefile-select": Mp.FileSelectResult;
        "open-convert": Mp.OpenConvertDialogEvent;
        "after-convert": Mp.ConvertResult;
    }

    interface Api {
        send: <K extends keyof MainChannelEventMap>(channel: K, data:MainChannelEventMap[K]) => void;
        receive: <K extends keyof RendererChannelEventMap>(channel:K, listener: (data: RendererChannelEventMap[K]) => void) => () => void;
    }

    const PLAYER_WINDOW_WEBPACK_ENTRY: string;
    const PLAYER_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const PLAYLIST_WINDOW_WEBPACK_ENTRY: string;
    const PLAYLIST_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const CONVERT_WINDOW_WEBPACK_ENTRY: string;
    const CONVERT_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

    namespace Mp {

        type ConvertFormat = "MP4" | "MP3"
        type ThumbButtonType = "Play" | "Pause" | "Previous" | "Next"
        type MainContextMenuType = "PlaybackRate" | "SeekSpeed" | "TogglePlaylistWindow" | "FitToWindow" | "ToggleFullscreen"
        type PlaylistContextMenuType = "Remove" | "RemoveAll" | "Trash" | "CopyFileName" | "CopyFullpath" | "Reveal" | "Metadata" | "Convert" | SortType
        type SortType = "NameAsc" | "NameDesc" | "DateAsc" | "DateDesc"

        type VideoFrameSize = "SizeNone" | "360p" | "480p" | "720p" | "1080p";
        type VideoRotation = "RotationNone" | "90Clockwise" | "90CounterClockwise"
        type AudioBitrate = "BitrateNone" | "128" | "160" | "192" | "320"

        type PlayStatus = "playing" | "paused" | "stopped"

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
            sortType:SortType;
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

        type MediaFile = {
            id:string;
            fullPath:string;
            src:string;
            name:string;
            date:number;
            extension:string;
        }

        type MediaState = {
            mute: boolean;
            fitToWindow: boolean;
            videoDuration: number;
            videoVolume: number;
            ampLevel: number;
            gainNode: GainNode | undefined;
            playbackRate:number;
            seekSpeed:number;
        }

        interface FfprobeData extends ffmpeg.FfprobeData {
            volume?:MediaVolume
        }

        type MediaVolume = {
            n_samples:string;
            mean_volume:string;
            max_volume:string;
        }

        type Slider = {
            slider:HTMLElement;
            track:HTMLElement;
            thumb:HTMLElement;
            rect:DOMRect;
            trackValue?:any;
            handler: (progress:number) => void;
        }

        type SliderState = {
            sliding:boolean;
            startX:number;
            slider:Slider | undefined;
        }

        type PlaylistItemSelection = {
            selectedId:string;
            selectedIds:string[];
        }

        type PlaylistDragState = {
            dragging: boolean,
            startElement:HTMLElement | undefined,
            startIndex: number,
            working:boolean,
        }

        type RenameData = {
            fileId:string;
            oldName:string;
            newName:string;
        }

        type ConvertOptions = {
            frameSize:VideoFrameSize;
            audioBitrate:AudioBitrate;
            rotation:VideoRotation;
            audioVolume:string;
            maxAudioVolume:boolean;
        }

        type ReadyEvent = {
            config:Config;
        }

        type FullscreenChange = {
            fullscreen:boolean;
        }

        type ChangePlaybackRateRequest = {
            playbackRate:number;
        }

        type ChangeSeekSpeedRequest = {
            seekSpeed:number;
        }

        type DropRequest = {
            files:string[];
            renderer:RendererName;
        }

        type PlaylistChangeEvent = {
            files:MediaFile[];
            clearPlaylist:boolean;
        }

        type ProgressEvent = {
            progress:number;
        }

        type LoadFileRequest = {
            index:number;
            isAbsolute:boolean;
        }

        type ChangePlayStatusRequest = {
            status:PlayStatus;
        }

        type FileLoadEvent = {
            currentFile:MediaFile;
            autoPlay:boolean;
        }

        type ReplaceFileRequest = {
            file:MediaFile;
        }

        type SaveImageRequet = {
            data:string;
            timestamp:number;
        }

        type CloseRequest = {
            mediaState:MediaState
        }

        type PlaylistItemSelectionChange = {
            selection:PlaylistItemSelection
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

        type RemovePlaylistItemResult = {
            removedFileIds:string[]
        }

        type ReleaseFileRequest = {
            fileIds:string[];
        }

        type RenameRequest = {
            id:string;
            name:string
        }

        type RenameResult = {
            file:MediaFile;
            error?:boolean;
        }

        type SortResult = {
            fileIds:string[]
        }

        type OpenConvertDialogEvent = {
            file:MediaFile;
        }

        type ConvertRequest = {
            sourcePath:string;
            convertFormat:ConvertFormat;
            options:ConvertOptions;
        }

        type ConvertResult = {
            success:boolean;
            message?:string;
        }

        type FileSelectResult = {
            file:MediaFile;
        }

        type ConfigChangeEvent = {
            config:Config;
        }

        type OpenFileDialogRequest = {
            fullPath:string;
        }

        type Event = {
            args?:any;
        }

        type Logging = {
            log:any;
        }

    }

}

export {}