import { IpcMainEvent } from "electron";

declare global {

    interface Window {
        api: Api;
    }

    type MainChannel = "minimize" | "toggle-maximize" | "close" | "drop" | "load-file" | "progress" | "open-main-context" |
                        "played" | "paused" | "reload" | "save-image" | "close-playlist" | "delete-file" |
                        "remove" | "open-playlist-context" | "change-playlist-order" | "prepare-tooltip" | "show-tooltip" | "hide-tooltip" |
                        "toggle-play" | "toggle-shuffle" | "toggle-fullscreen";
    type MainRendererChannel = "config" | "play" | "toggle-play" | "change-display-mode" | "reset" | "error" | "before-delete" | "log" | "after-toggle-maximize";
    type PlaylistRendererChannel = "after-drop"| "play" | "after-remove-playlist" | "reset" | "after-sort";
    type TooltipRendererChannel = "prepare-tooltip"

    interface IpcMainHandler {
        channel: MainChannel;
        handle: handler;
    }

    type handler<T extends Mp.Args> = (event: IpcMainEvent, data?:T) => (void | Promise<void>)

    interface Api {
        send: <T extends Mp.Args>(channel: MainChannel, data?:T) => void;
        receive: <T extends Mp.Args>(channel:MainRendererChannel | PlaylistRendererChannel | TooltipRendererChannel, listener: (data?: T) => void) => () => void;
    }

    const MAIN_WINDOW_WEBPACK_ENTRY: string;
    const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const PLAYLIST_WINDOW_WEBPACK_ENTRY: string;
    const PLAYLIST_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const TOOLTIP_WINDOW_WEBPACK_ENTRY: string;
    const TOOLTIP_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

    namespace Mp {

        type Bounds = {
            width:number;
            height:number;
            x:number;
            y:number;
        }

        type Config = {
            volume:number;
            ampLevel:number;
            mute:boolean;
            fitToWindow:boolean;
            bounds: Bounds;
            playlistBounds:Bounds;
            isMaximized:boolean;
            playlistVisible:boolean;
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
        }

        type Slider = {
            slider:HTMLElement;
            track:HTMLElement;
            thumb:HTMLElement;
            rect:DOMRect;
            trackValue:any;
            handler: (progress:number) => void;
        }

        type SliderState = {
            sliding:boolean;
            startX:number;
            slider:Slider | undefined;
        }

        type PlaylistDragState = {
            dragging: boolean,
            startElement:HTMLElement,
            startIndex: number,
            working:boolean,
        }

        type Position ={
            x:number;
            y:number;
        }

        type DropRequest = {
            files:string[];
            onPlaylist:boolean;
        }

        type ProgressArg = {
            progress:number;
        }

        type LoadFileRequest = {
            index:number;
            isAbsolute:boolean;
        }

        type ChangePlayStatusRequest = {
            played:boolean;
        }

        type LoadFileResult = {
            currentFile:MediaFile;
            autoPlay:boolean;
        }

        type SaveImageRequet = {
            data:string;
            timestamp:number;
        }

        type SaveRequest = {
            mediaState:MediaState
        }

        type OpenPlaylistContextRequest = {
            selectedFileRange:string[]
        }

        type ChangePlaylistOrderRequet = {
            start:number;
            end:number;
            currentIndex:number;
        }

        type DropResult = {
            files:MediaFile[];
            clearPlaylist?:boolean;
        }

        type RemovePlaylistRequest = {
            selectedFileRange:string[]
        }

        type RemovePlaylistResult = {
            removedFileIds:string[]
        }

        type BeforeDeleteArg = {
            releaseFile:boolean;
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

        type ErrorArgs = {
            message:string;
        }

        type Logging = {
            log:any;
        }

        type Args = LoadFileResult | DropRequest | ProgressArg | LoadFileRequest | TogglePlayRequest | SaveImageRequet | SaveRequest | ChangePlaylistOrderRequet |
                    DropResult | RemovePlaylistResult | SortResult | PrepareTooltipRequest | ShowTooltipRequest | OpenPlaylistContextRequest |
                    ErrorArgs | Config | Logging

    }

}
