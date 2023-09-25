import {app, ipcMain, clipboard, dialog, shell, protocol, nativeTheme} from "electron";

import fs from "fs";
import path from "path";
import proc from "child_process";
import url from "url"
import Helper from "./helper";
import Util, {EmptyFile} from "./util";
import Config from "./config";
import { FORWARD, BACKWARD, videoFormats, audioFormats } from "../constants";

const locked = app.requestSingleInstanceLock(process.argv);

if(!locked) {
    app.exit()
}

protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { bypassCSP: true } },
])

const helper = new Helper();
const util = new Util();
const config = new Config(app.getPath("userData"));

const Renderers:Renderer = {
    Player:undefined,
    Playlist:undefined,
    Convert:undefined,
}

const additionalFiles:string[] = [];
const playlistFiles:Mp.MediaFile[] = []
const secondInstanceState:Mp.SecondInstanceState = {
    timeout:undefined,
    requireInitPlaylist:false,
}

let mediaPlayStatus:Mp.PlayStatus;
let doShuffle = false;
let currentIndex = 0;
const playlistSelection:Mp.PlaylistItemSelection = {selectedId:"", selectedIds:[]};
let randomIndices:number[] = [];

const thumbButtonCallback = (button:Mp.ThumbButtonType) => {
    switch(button){
        case "Next":
            changeIndex(FORWARD);
            break;
        case "Pause":
            togglePlay();
            break;
        case "Play":
            togglePlay();
            break;
        case "Previous":
            changeIndex(BACKWARD)
            break;
    }
}

const thumButtons = helper.createThumButtons(thumbButtonCallback)

const mainContextMenuCallback = (menu:Mp.MainContextMenuType, args?:Mp.ContextMenuSubType) => {
    switch(menu){
        case "PlaybackSpeed":
            changePlaybackSpeed(Number(args));
            break;
        case "SeekSpeed":
            changeSeekSpeed(Number(args));
            break;
        case "TogglePlaylistWindow":
            togglePlaylistWindow();
            break;
        case "FitToWindow":
            changeSizeMode();
            break;
        case "ToggleFullscreen":
            respond("Player", "toggle-fullscreen", {})
            break;
        case "Theme":
            changeTheme(args as Mp.Theme);
            break;
    }
}

 const mainContext = helper.createMainContextMenu(config.data, mainContextMenuCallback)

const playlistContextMenuCallback = (menu:Mp.PlaylistContextMenuType, args?:Mp.ContextMenuSubType) => {
    switch(menu){
        case "Remove":
            removeFromPlaylist(playlistSelection.selectedIds);
            break;
        case "RemoveAll":
            clearPlaylist();
            break;
        case "Trash":
            requestReleaseFile(playlistSelection.selectedIds);
            break;
        case "CopyFileName":
            copyFileNameToClipboard(false);
            break;
        case "CopyFullpath":
            copyFileNameToClipboard(true);
            break;
        case "Reveal":
            reveal();
            break;
        case "Metadata":
            displayMetadata();
            break;
        case "Convert":
            openConvertDialog();
            break;
        case "Sort":
            sortPlayList(args as Mp.SortType);
            break;
    }
}

const playlistContext = helper.createPlaylistContextMenu(config.data, playlistContextMenuCallback)
const sortContext = helper.createPlaylistSortContextMenu(config.data, playlistContextMenuCallback)

const setSecondInstanceTimeout = () => {
    secondInstanceState.timeout = setTimeout(() => {
        afterSecondInstance()
    }, 1000);
}

const afterSecondInstance = () => {

    if(secondInstanceState.requireInitPlaylist){
        initPlaylist(additionalFiles)
    }else{
        addToPlaylist(additionalFiles)
    }

    additionalFiles.length = 0;

    secondInstanceState.timeout = undefined;
    secondInstanceState.requireInitPlaylist = true;

    if(!Renderers.Player) return;

    if(Renderers.Player.isFullScreen()){
        respond("Player", "toggle-fullscreen", {})
    }
    Renderers.Player.show();
}

app.on("second-instance", (_event:Event, _argv:string[], _workingDirectory:string, additionalData:string[]) => {

    if(!secondInstanceState.timeout){
        setSecondInstanceTimeout();
    }

    additionalFiles.push(...util.extractFilesFromArgv(additionalData))

})

app.on("ready", () => {

    nativeTheme.themeSource = config.data.theme

    setSecondInstanceTimeout();

    registerIpcChannels();

    protocol.registerFileProtocol("app", (request, callback) => {

        const filePath = url.fileURLToPath(
            "file://" + request.url.slice("app://".length),
        );

        callback(filePath);
    });

    Renderers.Player = helper.createMainWindow(config.data);
    Renderers.Playlist = helper.createPlaylistWindow(Renderers.Player, config.data)
    Renderers.Convert = helper.createConvertWindow(Renderers.Player)

    Renderers.Player.on("ready-to-show", () => {

        if(config.data.isMaximized){
            Renderers.Player?.maximize();
        }

        Renderers.Player?.setBounds(config.data.bounds)
        Renderers.Player?.setThumbarButtons(thumButtons[0])

        onPlayerReady();

    })

    Renderers.Player.on("maximize", onMaximize);
    Renderers.Player.on("unmaximize", onUnmaximize);

    Renderers.Player.on("closed", () => {
        Renderers.Player = undefined;
    });

});

const registerIpcChannels = () => {

    const addEventHandler = <K extends keyof MainChannelEventMap>(
        channel:K,
        handler: (data: MainChannelEventMap[K]) => void | Promise<void>
    ) => {
        ipcMain.on(channel, (_event, request) => handler(request))
    }

    addEventHandler("minimize", onMinimize)
    addEventHandler("toggle-maximize", toggleMaximize)
    addEventHandler("close", closeWindow)
    addEventHandler("drop", dropFiles)
    addEventHandler("load-file", onLoadRequest)
    addEventHandler("progress", changeProgressBar)
    addEventHandler("open-main-context", openMainContextMenu)
    addEventHandler("play-status-change", changePlayStatus)
    addEventHandler("reload", onReload)
    addEventHandler("save-image", saveImage)
    addEventHandler("close-playlist", onClosePlaylist)
    addEventHandler("playlist-item-selection-change", onPlaylistItemSelectionChange)
    addEventHandler("remove-playlist-item", onRemovePlaylistItem)
    addEventHandler("open-sort-context", openSortContextMenu)
    addEventHandler("file-released", deleteFile)
    addEventHandler("open-playlist-context", onOpenPlaylistContext)
    addEventHandler("change-playlist-order", changePlaylistItemOrder)
    addEventHandler("toggle-play", togglePlay)
    addEventHandler("toggle-shuffle", onToggleShuffle)
    addEventHandler("toggle-fullscreen", onToggleFullscreen)
    addEventHandler("close-convert", hideConvertDialog)
    addEventHandler("request-convert", startConvert)
    addEventHandler("request-cancel-convert", util.cancelConvert)
    addEventHandler("open-convert-sourcefile-dialog", openConvertSourceFileDialog)
    addEventHandler("rename-file", renameFile)
}

const respond = <K extends keyof RendererChannelEventMap>(rendererName:RendererName, channel:K, data:RendererChannelEventMap[K]) => {
    Renderers[rendererName]?.webContents.send(channel, data);
}

const showErrorMessage = async (ex:any) => {
    await dialog.showMessageBox({type:"error", message:ex.message})
}

const onPlayerReady = () => {

    Renderers.Player?.show();

    if(config.data.playlistVisible){
        Renderers.Playlist?.show();
    }

    respond("Player", "ready", {config:config.data});
    respond("Playlist", "ready", {config:config.data});
    respond("Convert", "ready", {config:config.data});

    togglePlay();

    initPlaylist(util.extractFilesFromArgv())
}

const loadMediaFile = (autoPlay:boolean) => {
    const currentFile = getCurrentFile();
    respond("Playlist", "after-file-load", {currentFile, autoPlay})
    respond("Player", "after-file-load", {currentFile, autoPlay})
}

const initPlaylist = (fullPaths:string[]) => {

    reset();

    fullPaths.map(fullPath => util.toFile(fullPath)).forEach(file => playlistFiles.push(file))

    currentIndex = 0;

    respond("Playlist", "playlist-change", {files:playlistFiles, clearPlaylist:true})

    sortPlayList(config.data.sortType);

    shuffleList();

    loadMediaFile(true);

}

const addToPlaylist = (fullPaths:string[]) => {

    const newFiles = fullPaths.filter(fullPath => playlistFiles.findIndex(file => file.fullPath == fullPath) < 0).map(fullPath => util.toFile(fullPath));

    playlistFiles.push(...newFiles)

    respond("Playlist", "playlist-change", {files:newFiles, clearPlaylist:false})

    sortPlayList(config.data.sortType);

    shuffleList();

    if(currentIndex < 0){
        loadMediaFile(false);
    }

}

const getCurrentFile = () => {

    if(currentIndex < 0) return EmptyFile;

    if(!playlistFiles.length) return EmptyFile;

    return playlistFiles[currentIndex];

}

const reset = () => {
    playlistFiles.length = 0;
    randomIndices.length = 0;
    currentIndex = -1;
    respond("Playlist", "clear-playlist", {})
}

const changeSizeMode = () => {
    config.data.video.fitToWindow = !config.data.video.fitToWindow
    respond("Player", "change-display-mode", {config:config.data})
}

const changeTheme = (theme:Mp.Theme) => {
    nativeTheme.themeSource = theme
    config.data.theme = theme;
    respond("Player", "change-theme", {config:config.data})
    respond("Playlist", "change-theme", {config:config.data})
    respond("Convert", "change-theme", {config:config.data})
}

const onUnmaximize = () => {
    config.data.isMaximized = false;
    respond("Player", "after-toggle-maximize", {config:config.data})
}

const onMaximize = () => {
    config.data.isMaximized = true;
    respond("Player","after-toggle-maximize", {config:config.data})
}

const toggleMaximize = () => {

    if(!Renderers.Player) return;

    if(Renderers.Player.isMaximized()){
        Renderers.Player.unmaximize();
        Renderers.Player.setBounds(config.data.bounds)
    }else{
        config.data.bounds = Renderers.Player.getBounds()
        Renderers.Player.maximize();
    }
}

const saveConfig = (data:Mp.MediaState) => {

    if(!Renderers.Player || !Renderers.Playlist) return;

    try{
        config.data.isMaximized = Renderers.Player.isMaximized();
        config.data.playlistBounds = Renderers.Playlist.getBounds()
        config.data.audio.volume = data.videoVolume;
        config.data.audio.ampLevel = data.ampLevel;
        config.data.video.fitToWindow = data.fitToWindow;
        config.data.audio.mute = data.mute;

        config.save();
    }catch(ex){
        return showErrorMessage(ex);
    }
}

const closeWindow = (data:Mp.CloseRequest) => {
    saveConfig(data.mediaState);
    Renderers.Playlist?.close();
    Renderers.Player?.close();
}

const shuffleList = () => {

    if(!doShuffle) return;

    const target = new Array(playlistFiles.length).fill(undefined).map((_v, i) => i).filter(i => i !== currentIndex);
    randomIndices = util.shuffle(target)

}

const getRandomIndex = (value:number) => {

    if(value > 0){
        randomIndices.unshift(currentIndex);
        return randomIndices.pop() as number;
    }

    randomIndices.push(currentIndex);
    return randomIndices.shift() as number;

}

const changeIndex = (index:number) => {

    let nextIndex = doShuffle ? getRandomIndex(index) : currentIndex + index;

    if(nextIndex >= playlistFiles.length){
        nextIndex = 0;
    }

    if(nextIndex < 0){
        nextIndex = playlistFiles.length - 1
    }

    currentIndex = nextIndex;

    loadMediaFile(false);
}

const selectFile = (index:number) => {
    currentIndex = index;
    loadMediaFile(true);
}

const changePlayStatus = (data:Mp.ChangePlayStatusRequest) => {

    mediaPlayStatus = data.status;

    Renderers.Player?.setThumbarButtons([])

    if(mediaPlayStatus == "playing"){
        Renderers.Player?.setThumbarButtons(thumButtons[1])
    }else{
        Renderers.Player?.setThumbarButtons(thumButtons[0])
    }

}

const togglePlay = () => {
    respond("Player", "toggle-play", {})
}

const dropFiles = (data:Mp.DropRequest) => {

    if(data.renderer === "Playlist"){
        addToPlaylist(data.files)
    }

    if(data.renderer === "Player"){
        initPlaylist(data.files)
    }

}

const changePlaylistItemOrder = (data:Mp.ChangePlaylistOrderRequet) => {

    if(data.start === data.end) return;

    const replacing = playlistFiles.splice(data.start, 1)[0];
    playlistFiles.splice(data.end, 0, replacing)

    currentIndex = data.currentIndex;
}

const clearPlaylist = () => {

    reset();
    loadMediaFile(false);

}

const removeFromPlaylist = (selectedIds:string[]) => {

    if(!selectedIds.length) return;

    const removeIndices = playlistFiles.filter(file => selectedIds.includes(file.id)).map(file => playlistFiles.indexOf(file))
    const isCurrentFileRemoved = removeIndices.includes(currentIndex);

    const newFiles = playlistFiles.filter((_,index) => !removeIndices.includes(index));
    playlistFiles.length = 0;
    playlistFiles.push(...newFiles)

    respond("Playlist", "after-remove-playlist", {removedFileIds:selectedIds})

    currentIndex = getIndexAfterRemove(removeIndices)

    if(isCurrentFileRemoved){
        loadMediaFile(false);
    }

}

const getIndexAfterRemove = (removeIndices:number[]) => {

    if(removeIndices.includes(currentIndex)){

        if(!playlistFiles.length) return -1;

        const nextIndex = removeIndices[0]

        if(nextIndex >= playlistFiles.length){
            return playlistFiles.length - 1
        }

        return nextIndex;
    }

    if(removeIndices[0] < currentIndex){
        return currentIndex - removeIndices.length
    }

    return currentIndex

}

const requestReleaseFile = (selectedIds:string[]) => {

    if(!selectedIds.length) return;

    respond("Player", "release-file", {fileIds:selectedIds})

}

const deleteFile = async (data:Mp.ReleaseFileRequest) => {

    if(!data.fileIds.length) return;

    try{

        const targetFilePaths = playlistFiles.filter(file => data.fileIds.includes(file.id)).map(file => file.fullPath);

        if(!targetFilePaths.length) return;

        await Promise.all(targetFilePaths.map(async item => await shell.trashItem(item)))

        removeFromPlaylist(data.fileIds);

    }catch(ex){
        showErrorMessage(ex);
    }
}

const reveal = () => {

    if(!playlistSelection.selectedId) return;

    const file = playlistFiles.find(file => file.id == playlistSelection.selectedId)

    if(!file) return;

    proc.exec(`explorer /e,/select,${file.fullPath}`);
}

const copyFileNameToClipboard = (fullPath:boolean) => {

    if(!playlistSelection.selectedId) return;

    const file = playlistFiles.find(file => file.id == playlistSelection.selectedId)

    if(!file) return;

    clipboard.writeText(fullPath ? file.fullPath : file.name);

}

const sortPlayList = (sortType:Mp.SortType) => {

    respond("Playlist", "sort-type-change", sortType)

    const currentFileId = getCurrentFile().id;

    config.data.sortType = sortType;

    if(!playlistFiles.length) return;

    util.sort(playlistFiles, sortType)

    const sortedIds = playlistFiles.map(file => file.id);

    if(currentFileId){
        currentIndex = sortedIds.findIndex(id => id === currentFileId);
    }

    respond("Playlist", "after-sort", {fileIds:sortedIds})

}

const displayMetadata = async () => {

    const file = playlistFiles.find(file => file.id == playlistSelection.selectedId)
    if(!file || !Renderers.Player) return;

    const metadata = await util.getMediaMetadata(file.fullPath)
    const metadataString = JSON.stringify(metadata, undefined, 2);
    const result = await dialog.showMessageBox(Renderers.Player, {type:"info", message:metadataString,  buttons:["Copy", "OK"], noLink:true})
    if(result.response === 0){
        clipboard.writeText(metadataString);
    }
}

const togglePlaylistWindow = () => {

    config.data.playlistVisible = !config.data.playlistVisible;
    if(config.data.playlistVisible){
        Renderers.Playlist?.show();
    }else{
        Renderers.Playlist?.hide();
    }

}

const openConvertDialog = () => {
    const file = playlistFiles.find(file => file.id == playlistSelection.selectedId) ?? EmptyFile
    respond("Convert", "open-convert", {file})
    Renderers.Convert?.show();
}

const openConvertSourceFileDialog = (e:Mp.OpenFileDialogRequest) => {

    if(!Renderers.Convert) return;

    const files = dialog.showOpenDialogSync(Renderers.Convert, {
        title: "Select file to convert",
        defaultPath: e.fullPath,
        filters: [
            { name: "Media File", extensions: videoFormats.concat(audioFormats) },
        ],
        properties: ["openFile", "multiSelections"]
    })

    if(files){
        respond("Convert", "after-sourcefile-select", {file:util.toFile(files[0])})
    }
}

const changePlaybackSpeed = (playbackSpeed:number) => {
    respond("Player", "change-playback-speed", {playbackSpeed})
}

const changeSeekSpeed = (seekSpeed:number) => {
    respond("Player", "change-seek-speed", {seekSpeed});
}

const changeProgressBar = (data:Mp.ProgressEvent) => Renderers.Player?.setProgressBar(data.progress);

const openMainContextMenu = () => mainContext.popup({window:Renderers.Player});

const openSortContextMenu = (e:Mp.Position) => sortContext.popup({window:Renderers.Playlist, x:e.x, y:e.y - 110})

const hideConvertDialog = () => Renderers.Convert?.hide();

const saveImage = (data:Mp.SaveImageRequet) => {

    if(!Renderers.Player) return;

    const savePath = dialog.showSaveDialogSync(Renderers.Player, {
        defaultPath: path.join(config.data.path.captureDestDir, `${getCurrentFile().name}-${data.timestamp}.jpeg`),
        filters: [
            { name: "Image", extensions: ["jpeg", "jpg"] },
        ],
    })

    if(!savePath) return;

    config.data.path.captureDestDir = path.dirname(savePath);

    fs.writeFileSync(savePath, data.data, "base64")
}

const startConvert = async (data:Mp.ConvertRequest) => {

    if(!Renderers.Convert) return endConvert();

    const file = util.toFile(data.sourcePath);

    if(!util.exists(file.fullPath)) return endConvert();

    const extension = data.convertFormat.toLocaleLowerCase();
    const fileName =  file.name.replace(path.extname(file.name), "")

    const selectedPath = dialog.showSaveDialogSync(Renderers.Convert, {
        defaultPath: path.join(config.data.path.convertDestDir, `${fileName}.${extension}`),
        filters: [
            {
                name:data.convertFormat === "MP4" ? "Video" : "Audio",
                extensions: [extension]
            },
        ],
    })

    if(!selectedPath) return endConvert()

    config.data.path.convertDestDir = path.dirname(selectedPath)

    const shouldReplace = getCurrentFile().fullPath === selectedPath

    const timestamp = String(new Date().getTime());
    const savePath = shouldReplace ? path.join(path.dirname(selectedPath), path.basename(selectedPath) + timestamp) : selectedPath

    Renderers.Convert.hide()

    respond("Player", "toggle-convert", {})

    try{

        if(data.convertFormat === "MP4"){
            await util.convertVideo(data.sourcePath, savePath, data.options)
        }else{
            await util.convertAudio(data.sourcePath, savePath, data.options)
        }

        if(shouldReplace){
            fs.renameSync(savePath, selectedPath)
        }

        endConvert();

    }catch(ex:any){

        endConvert(ex.message)

    }finally{

        openConvertDialog();
        respond("Player", "toggle-convert", {})

    }

}

const endConvert = (message?:string) => {

    if(message){
        respond("Convert", "after-convert", {success:false, message})
    }else{
        respond("Convert", "after-convert", {success:true})
    }

}

const renameFile = async (data:Mp.RenameRequest) => {

    const fileIndex = playlistFiles.findIndex(file => file.id == data.id)
    const file = playlistFiles[fileIndex];
    const filePath = file.fullPath;
    const newPath = path.join(path.dirname(filePath), data.name)

    try{

        if(util.exists(newPath)){
            throw new Error(`File name "${data.name}" exists`)
        }

        fs.renameSync(filePath, newPath)

        const newMediaFile = util.updateFile(newPath, file);
        playlistFiles[fileIndex] = newMediaFile

        respond("Playlist", "after-rename", {file:newMediaFile})

        if(fileIndex == currentIndex){
            respond("Player", "after-file-load", {currentFile:newMediaFile, autoPlay:mediaPlayStatus == "playing"})
        }

    }catch(ex){
        await showErrorMessage(ex)
        respond("Playlist", "after-rename", {file:file, error:true})
    }
}

const onMinimize = () => Renderers.Player?.minimize();

const onLoadRequest = (data:Mp.LoadFileRequest) => {
    if(data.isAbsolute){
        selectFile(data.index)
    }else{
        changeIndex(data.index)
    }
}

const onReload = () => {
    Renderers.Playlist?.reload();
    Renderers.Player?.reload();
}

const onClosePlaylist = () => {
    config.data.playlistVisible = false;
    Renderers.Playlist?.hide()
}

const onPlaylistItemSelectionChange = (data:Mp.PlaylistItemSelectionChange) => {
    playlistSelection.selectedId = data.selection.selectedId;
    playlistSelection.selectedIds = data.selection.selectedIds
}

const onRemovePlaylistItem = (data:Mp.RemovePlaylistItemRequest) => {
    removeFromPlaylist(data.selectedIds);
}

const onOpenPlaylistContext = () => {
    playlistContext.popup({window:Renderers.Playlist})
}

const onToggleShuffle = () => {
    doShuffle = !doShuffle;
    shuffleList();
}

const onToggleFullscreen = (e:Mp.FullscreenChange) => {

    if(e.fullscreen){
        Renderers.Player?.setFullScreen(true)
        Renderers.Playlist?.hide();
        Renderers.Convert?.hide();
    }else{
        Renderers.Player?.setFullScreen(false)
        if(config.data.playlistVisible) Renderers.Playlist?.show();
        Renderers.Player?.focus();
    }
}
