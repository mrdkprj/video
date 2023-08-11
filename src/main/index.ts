import {app, ipcMain, clipboard, dialog, shell, protocol} from "electron";
import fs from "fs";
import path from "path";
import proc from "child_process";
import url from "url"
import Helper from "./helper";
import Util, {EmptyFile} from "./util";
import Config from "./config";
import { FORWARD, BACKWARD, FIT_TO_WINDOW_ITEM_INDEX, videoFormats, audioFormats } from "../constants";

protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { bypassCSP: true } },
])

const Renderers:Renderer = {
    Main:null,
    Playlist:null,
    Convert:null,
}

const additionalFiles:string[] = [];
const playlistFiles:Mp.MediaFile[] = []
const helper = new Helper();
const util = new Util();
const config = new Config(app.getPath("userData"));

let isReady = false;
let mediaPlayStatus:Mp.PlayStatus;
let doShuffle = false;
let currentIndex = 0;
let selectedFileIds:string[] = [];
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

const mainContextMenuCallback = (menu:Mp.MainContextMenuType, args?:any) => {
    switch(menu){
        case "PlaybackRate":
            changePlaybackRate(args);
            break;
        case "SeekSpeed":
            changeSeekSpeed(args);
            break;
        case "Convert":
            openConvertDialog();
            break;
        case "OpenPlaylist":
            openPlaylist();
            break;
        case "FitToWindow":
            changeSizeMode();
            break;
    }
}

const mainContext = helper.createMainContextMenu(mainContextMenuCallback)

const playlistContextMenuCallback = (menu:Mp.PlaylistContextMenuType) => {
    switch(menu){
        case "Remove":
            removeFromPlaylist();
            break;
        case "RemoveAll":
            clearPlaylist();
            break;
        case "Trash":
            requestReleaseFile();
            break;
        case "CopyFileName":
            copyFileNameToClipboard();
            break;
        case "Reveal":
            reveal();
            break;
        case "NameAsc":
            sortPlayList(menu);
            break;
        case "NameDesc":
            sortPlayList(menu);
            break;
        case "DateAsc":
            sortPlayList(menu);
            break;
        case "DateDesc":
            sortPlayList(menu);
            break;
    }
}

const playlistContext = helper.createPlaylistContextMenu(config.data, playlistContextMenuCallback)

const locked = app.requestSingleInstanceLock(process.argv);

if(!locked) {
    app.quit()
}

const onSecondInstanceReady = () => {
    initPlaylist([additionalFiles.shift()])
    Renderers.Main.show();
}

app.on("second-instance", (_event:Event, _argv:string[], _workingDirectory:string, additionalData:string[]) => {

    if(!isReady){
        additionalFiles.push(...util.extractFilesFromArgv(additionalData))
        return;
    }

    if(!additionalFiles.length){

        additionalFiles.push(...util.extractFilesFromArgv(additionalData))
        setTimeout(() => {
            onSecondInstanceReady();
        }, 1000);

    }else{
        additionalFiles.push(...util.extractFilesFromArgv(additionalData))
    }

})

app.on("ready", () => {

    config.init();

    registerIpcChannels();

    protocol.registerFileProtocol("app", (request, callback) => {

        const filePath = url.fileURLToPath(
            "file://" + request.url.slice("app://".length),
        );

        callback(filePath);
    });

    Renderers.Main = helper.createMainWindow(config.data)

    Renderers.Main.on("ready-to-show", () => {

        if(config.data.isMaximized){
            Renderers.Main.maximize();
        }

        Renderers.Main.setBounds(config.data.bounds)
        Renderers.Main.setThumbarButtons(thumButtons[0])

        onReady();

    })

    Renderers.Main.on("closed", () => {
        Renderers.Main = null
    });

    Renderers.Main.on("maximize", onMaximize);
    Renderers.Main.on("unmaximize", onUnmaximize);

    Renderers.Playlist = helper.createPlaylistWindow(Renderers.Main, config.data)

    Renderers.Convert = helper.createConvertWindow(Renderers.Main)

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
    addEventHandler("close", onClose)
    addEventHandler("drop", onDrop)
    addEventHandler("load-file", onLoadRequest)
    addEventHandler("progress", onProgress)
    addEventHandler("open-main-context", onOpenMainContext)
    addEventHandler("play-status-change", onPlayStatusChanged)
    addEventHandler("reload", onReload)
    addEventHandler("save-image", onSaveImage)
    addEventHandler("close-playlist", onClosePlaylist)
    addEventHandler("remove-playlist-item", onRemovePlaylistItem)
    addEventHandler("file-released", onFileReleased)
    addEventHandler("open-playlist-context", onOpenPlaylistContext)
    addEventHandler("change-playlist-order", onChangePlaylistOrder)
    addEventHandler("toggle-play", onTogglePlay)
    addEventHandler("toggle-shuffle", onToggleShuffle)
    addEventHandler("toggle-fullscreen", onToggleFullscreen)
    addEventHandler("close-convert", onCloseConvertDiglog)
    addEventHandler("request-convert", onConnvertRequest)
    addEventHandler("request-cancel-convert", onCancelConvertRequest)
    addEventHandler( "open-convert-sourcefile-dialog", onOpenConvertSourceFileDialog)
    addEventHandler("rename-file", onRenameRequest)
}

const respond = <K extends keyof RendererChannelEventMap>(rendererName:RendererName, channel:K, data:RendererChannelEventMap[K]) => {
    Renderers[rendererName].webContents.send(channel, data);
}

const showErrorMessage = async (ex:any) => {
    await dialog.showMessageBox({type:"error", message:ex.message})
}

const onReady = () => {

    isReady = true;

    Renderers.Main.show();

    if(config.data.playlistVisible){
        Renderers.Playlist.show();
    }

    mainContext.items[FIT_TO_WINDOW_ITEM_INDEX].checked = config.data.video.fitToWindow

    respond("Main", "ready", {config:config.data});

    togglePlay();

    initPlaylist(util.extractFilesFromArgv())
}

const sendCurrentFile = (autoPlay:boolean) => {
    const currentFile = getCurrentFile();
    respond("Playlist", "after-file-load", {currentFile, autoPlay})
    respond("Main", "after-file-load", {currentFile, autoPlay})
}

const initPlaylist = (fullPaths:string[]) => {

    reset();

    fullPaths.concat(additionalFiles).map(fullPath => util.toFile(fullPath)).forEach(file => playlistFiles.push(file))

    sortPlayList("NameAsc");

    currentIndex = 0;

    additionalFiles.length = 0;

    shuffleList();

    respond("Playlist", "clear-playlist", null)

    respond("Playlist", "after-drop", {files:playlistFiles})

    sendCurrentFile(true);

}

const addToPlaylist = (fullPaths:string[]) => {

    const newFiles = fullPaths.filter(fullPath => playlistFiles.findIndex(o => o.fullPath == fullPath) < 0).map(fullPath => util.toFile(fullPath));

    newFiles.forEach(file => playlistFiles.push(file))

    shuffleList();

    respond("Playlist", "after-drop", {files:newFiles})

    if(currentIndex < 0){
        sendCurrentFile(false);
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
    Renderers.Main.webContents.send("reset")
    Renderers.Playlist.webContents.send("reset")
}

const changeSizeMode = () => {
    config.data.video.fitToWindow = !config.data.video.fitToWindow
    mainContext.items[1].checked = config.data.video.fitToWindow
    respond("Main", "change-display-mode", {config:config.data})
}

const onUnmaximize = () => {
    config.data.isMaximized = false;
    respond("Main", "after-toggle-maximize", {config:config.data})
}

const onMaximize = () => {
    config.data.isMaximized = true;
    respond("Main","after-toggle-maximize", {config:config.data})
}

const toggleMaximize = () => {

    if(Renderers.Main.isMaximized()){
        Renderers.Main.unmaximize();
        Renderers.Main.setBounds(config.data.bounds)
    }else{
        config.data.bounds = Renderers.Main.getBounds();
        Renderers.Main.maximize();
    }
}

const saveConfig = (data:Mp.MediaState) => {

    try{
        config.data.isMaximized = Renderers.Main.isMaximized();
        config.data.playlistBounds = Renderers.Playlist.getBounds()
        config.save(data);
    }catch(ex){
        return showErrorMessage(ex);
    }
}

const closeWindow = (data:Mp.CloseRequest) => {
    saveConfig(data.mediaState);
    Renderers.Playlist.close();
    Renderers.Main.close();
}

const shuffleList = () => {

    if(!doShuffle) return;

    const target = new Array(playlistFiles.length).fill(undefined).map((_v, i) => i).filter(i => i !== currentIndex);
    randomIndices = util.shuffle(target)

}

const getRandomIndex = (value:number) => {

    if(value > 0){
        randomIndices.unshift(currentIndex);
        return randomIndices.pop();
    }else{
        randomIndices.push(currentIndex);
        return randomIndices.shift();
    }

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

    sendCurrentFile(false);
}

const selectFile = (index:number) => {
    currentIndex = index;
    sendCurrentFile(true);
}

const changePlayStatus = (status:Mp.PlayStatus) => {

    mediaPlayStatus = status;

    Renderers.Main.setThumbarButtons([])

    if(mediaPlayStatus == "playing"){
        Renderers.Main.setThumbarButtons(thumButtons[1])
    }else{
        Renderers.Main.setThumbarButtons(thumButtons[0])
    }

}

const togglePlay = () => {
    respond("Main", "toggle-play", null)
}

const dropFiles = (data:Mp.DropRequest) => {

    if(data.renderer === "Playlist"){
        addToPlaylist(data.files)
    }

    if(data.renderer === "Main"){
        initPlaylist(data.files)
    }

}

const movePlaylistFiles = (data:Mp.ChangePlaylistOrderRequet) => {

    if(data.start === data.end) return;

    const replacing = playlistFiles.splice(data.start, 1)[0];
    playlistFiles.splice(data.end, 0, replacing)

    currentIndex = data.currentIndex;
}

const clearPlaylist = () => {

    reset();
    sendCurrentFile(false);

}

const removeFromPlaylist = () => {

    if(!selectedFileIds.length) return;

    const removeIndices = playlistFiles.filter(file => selectedFileIds.includes(file.id)).map(file => playlistFiles.indexOf(file))
    const isCurrentFileRemoved = removeIndices.includes(currentIndex);

    const newFiles = playlistFiles.filter((_,index) => !removeIndices.includes(index));
    playlistFiles.length = 0;
    playlistFiles.push(...newFiles)

    respond("Playlist", "after-remove-playlist", {removedFileIds:selectedFileIds})

    currentIndex = getIndexAfterRemove(removeIndices)

    if(isCurrentFileRemoved){
        sendCurrentFile(false);
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

}

const requestReleaseFile = () => {

    if(!selectedFileIds.length) return;

    respond("Main", "release-file", {fileIds:selectedFileIds})

}

const deleteFile = async () => {

    if(!selectedFileIds.length) return;

    try{

        const targetFilePaths = playlistFiles.filter(file => selectedFileIds.includes(file.id)).map(file => file.fullPath);

        if(!targetFilePaths.length) return;

        await Promise.all(targetFilePaths.map(async item => await shell.trashItem(item)))

        removeFromPlaylist();

    }catch(ex){
        showErrorMessage(ex);
    }
}

const reveal = () => {

    if(!selectedFileIds.length || selectedFileIds.length > 1) return;

    const file = playlistFiles.find(file => file.id == selectedFileIds[0])

    if(!file) return;

    proc.exec("explorer /e,/select," + file.fullPath);
}

const copyFileNameToClipboard = () => {

    if(!selectedFileIds.length || selectedFileIds.length > 1) return;

    const file = playlistFiles.find(file => file.id == selectedFileIds[0])

    if(!file) return;

    clipboard.writeText(file.name);

}

const sortPlayList = (sortType:Mp.SortType) => {

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

const openPlaylist = () => {
    config.data.playlistVisible = true;
    Renderers.Playlist.show();
}

const openConvertDialog = () => {
    respond("Convert", "open-convert", {file:getCurrentFile()})
    Renderers.Convert.show();
}

const openConvertSourceFileDialog = () => {
    const files = dialog.showOpenDialogSync(Renderers.Convert, {
        title: "Select file to convert",
        defaultPath: getCurrentFile().fullPath,
        filters: [
            { name: "Media File", extensions: videoFormats.concat(audioFormats) },
        ],
        properties: ["openFile", "multiSelections"]
    })

    if(files){
        respond("Convert", "after-sourcefile-select", {fullPath:files[0]})
    }
}

const changePlaybackRate = (playbackRate:number) => {
    respond("Main", "change-playback-rate", {playbackRate})
}

const changeSeekSpeed = (seekSpeed:number) => {
    respond("Main", "change-seek-speed", {seekSpeed});
}

const saveImage = (data:Mp.SaveImageRequet) => {

    const savePath = dialog.showSaveDialogSync(Renderers.Main, {
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

    const fileExists = util.exists(data.sourcePath)

    if(!fileExists) return onConvertEnd();

    const extension = data.video ? "mp4" : "mp3"
    const name = data.video ? "Video" : "Audio"

    const file = util.toFile(data.sourcePath);
    const fileName =  file.name.replace(path.extname(file.name), "")

    const selectedPath = dialog.showSaveDialogSync(Renderers.Convert, {
        defaultPath: path.join(config.data.path.convertDestDir, `${fileName}.${extension}`),
        filters: [
            { name: name, extensions: [extension] },
        ],
    })

    if(!selectedPath) return onConvertEnd()

    config.data.path.convertDestDir = path.dirname(selectedPath)

    const shouldReplace = getCurrentFile().fullPath === selectedPath

    const timestamp = String(new Date().getTime());
    const savePath = shouldReplace ? path.join(path.dirname(selectedPath), path.basename(selectedPath) + timestamp) : selectedPath

    Renderers.Convert.hide()

    respond("Main", "toggle-convert", null)

    try{

        if(data.video){
            await util.convertVideo(data.sourcePath, savePath, data.options)
        }else{
            await util.extractAudio(data.sourcePath, savePath, data.options)
        }

        if(shouldReplace){
            fs.renameSync(savePath, selectedPath)
        }

        onConvertEnd();

    }catch(ex:any){

        onConvertEnd(ex.message)

    }finally{

        openConvertDialog();
        respond("Main", "toggle-convert", null)

    }

}

const onConvertEnd = (message?:string) => {

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
            respond("Main", "after-file-load", {currentFile:newMediaFile, autoPlay:mediaPlayStatus == "playing"})
        }

    }catch(ex){
        await showErrorMessage(ex)
        respond("Playlist", "after-rename", {file:file, error:true})
    }
}

const onMinimize = () => Renderers.Main.minimize();

const onClose = (data:Mp.CloseRequest) => closeWindow(data);

const onDrop = (data:Mp.DropRequest) => dropFiles(data);

const onLoadRequest = (data:Mp.LoadFileRequest) => {
    if(data.isAbsolute){
        selectFile(data.index)
    }else{
        changeIndex(data.index)
    }
}

const onProgress = (data:Mp.ProgressEvent) => Renderers.Main.setProgressBar(data.progress);

const onOpenMainContext = () => mainContext.popup({window:Renderers.Main});

const onPlayStatusChanged = (data:Mp.ChangePlayStatusRequest) => changePlayStatus(data.status);

const onReload = () => {
    Renderers.Playlist.reload();
    Renderers.Main.reload();
}

const onSaveImage = (data:Mp.SaveImageRequet) => saveImage(data);

const onClosePlaylist = () => {
    config.data.playlistVisible = false;
    Renderers.Playlist.hide()
}

const onRemovePlaylistItem = (data:Mp.RemovePlaylistItemRequest) => {
    selectedFileIds = data.fileIds;
    removeFromPlaylist();
}

const onFileReleased = async () => {
    await deleteFile()
}

const onOpenPlaylistContext = (data:Mp.OpenPlaylistContextRequest) => {
    selectedFileIds = data.fileIds;
    playlistContext.popup({window:Renderers.Playlist})
}

const onChangePlaylistOrder = (data:Mp.ChangePlaylistOrderRequet) => movePlaylistFiles(data);

const onTogglePlay = () => togglePlay();

const onToggleShuffle = () => {
    doShuffle = !doShuffle;
    shuffleList();
}

const onToggleFullscreen = () => {

    if(Renderers.Main.isFullScreen()){
        Renderers.Main.setFullScreen(false)
        if(config.data.playlistVisible) Renderers.Playlist.show();
        Renderers.Main.focus();
    }else{
        Renderers.Main.setFullScreen(true)
        Renderers.Playlist.hide();
    }
}

const onCloseConvertDiglog = () => Renderers.Convert.hide();

const onConnvertRequest = (data:Mp.ConvertRequest) => startConvert(data)

const onCancelConvertRequest = () => util.cancelConvert();

const onOpenConvertSourceFileDialog = () => openConvertSourceFileDialog();

const onRenameRequest = async (data:Mp.RenameRequest) => await renameFile(data)