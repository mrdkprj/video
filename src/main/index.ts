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

const renderer:Renderer = {
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
let fileMap:{[key:string]:Mp.MediaFile} = {}

const thumbButtonCallback = (button:ThumbButtonType) => {
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

const mainContextMenuCallback = (menu:MainContextMenuType, args?:any) => {
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

const playlistContextMenuCallback = (menu:PlaylistContextMenuType) => {
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
    renderer.Main.show();
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

    renderer.Main = helper.createMainWindow(config.data)

    renderer.Main.on("ready-to-show", () => {

        if(config.data.isMaximized){
            renderer.Main.maximize();
        }

        renderer.Main.setBounds(config.data.bounds)
        renderer.Main.setThumbarButtons(thumButtons[0])

        onReady();

    })

    renderer.Main.on("closed", () => {
        renderer.Main = null
    });

    renderer.Main.on("maximize", onMaximize);
    renderer.Main.on("unmaximize", onUnmaximize);

    renderer.Playlist = helper.createPlaylistWindow(renderer.Main, config.data)

    renderer.Convert = helper.createConvertWindow(renderer.Main)

});

const registerIpcChannels = () => {

    const handlers:IpcMainHandler[] = [
        {channel:"minimize", handle:onMinimize},
        {channel:"toggle-maximize", handle:toggleMaximize},
        {channel:"close", handle:onClose},
        {channel:"drop", handle:onDrop},
        {channel:"load-file", handle:onLoadRequest},
        {channel:"progress", handle:onProgress},
        {channel:"open-main-context", handle:onOpenMainContext},
        {channel:"play-status-change", handle:onPlayStatusChanged},
        {channel:"reload", handle:onReload},
        {channel:"save-image", handle:onSaveImage},
        {channel:"close-playlist", handle:onClosePlaylist},
        {channel:"remove-playlist-item", handle:onRemovePlaylistItem},
        {channel:"file-released", handle:onFileReleased},
        {channel:"open-playlist-context", handle:onOpenPlaylistContext},
        {channel:"change-playlist-order", handle:onChangePlaylistOrder},
        {channel:"toggle-play", handle:onTogglePlay},
        {channel:"toggle-shuffle", handle:onToggleShuffle},
        {channel:"toggle-fullscreen", handle:onToggleFullscreen},
        {channel:"close-convert", handle:onCloseConvertDiglog},
        {channel:"request-convert", handle:onConnvertRequest},
        {channel:"request-cancel-convert", handle:onCancelConvertRequest},
        {channel: "open-convert-sourcefile-dialog", handle:onOpenConvertSourceFileDialog},
        {channel:"rename-file", handle:onRenameRequest},
    ]

    handlers.forEach(handler => ipcMain.on(handler.channel, (event, request) => handler.handle(event, request)));
}

const respond = <T extends Mp.Args>(rendererName:RendererName, channel:RendererChannel, data:T) => {
    renderer[rendererName].webContents.send(channel, data);
}

const showErrorMessage = async (ex:any) => {
    await dialog.showMessageBox({type:"error", message:ex.message})
}

const onReady = () => {

    isReady = true;

    renderer.Main.show();

    if(config.data.playlistVisible){
        renderer.Playlist.show();
    }

    mainContext.items[FIT_TO_WINDOW_ITEM_INDEX].checked = config.data.video.fitToWindow

    respond<Mp.OnReady>("Main", "ready", {config:config.data});

    togglePlay();

    initPlaylist(util.extractFilesFromArgv())

}

const sendCurrentFile = (autoPlay:boolean) => {
    const currentFile = getCurrentFile();
    respond<Mp.OnFileLoad>("Playlist", "on-file-load", {currentFile, autoPlay})
    respond<Mp.OnFileLoad>("Main", "on-file-load", {currentFile, autoPlay})
}

const initPlaylist = (fullPaths:string[]) => {

    reset();

    fullPaths.concat(additionalFiles).forEach(fullPath => {
        const file = util.toFile(fullPath)
        playlistFiles.push(file)
        fileMap[file.id] = file;
    })

    sortPlayList("NameAsc");

    currentIndex = 0;

    additionalFiles.length = 0;

    shuffleList();

    respond<Mp.Args>("Playlist", "clear-playlist", null)

    respond<Mp.DropResult>("Playlist", "after-drop", {files:playlistFiles})

    sendCurrentFile(true);

}

const addToPlaylist = (fullPaths:string[]) => {

    const newFiles = fullPaths.map(fullpath => util.toFile(fullpath)).filter(file => !fileMap[file.id]);

    newFiles.forEach(file => {
        playlistFiles.push(file)
        fileMap[file.id] = file
    })

    shuffleList();

    respond<Mp.DropResult>("Playlist", "after-drop", {files:newFiles})

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
    fileMap = {}
    currentIndex = -1;
    renderer.Main.webContents.send("reset")
    renderer.Playlist.webContents.send("reset")
}

const changeSizeMode = () => {
    config.data.video.fitToWindow = !config.data.video.fitToWindow
    mainContext.items[1].checked = config.data.video.fitToWindow
    respond<Mp.ConfigChanged>("Main", "change-display-mode", {config:config.data})
}

const onUnmaximize = () => {
    config.data.isMaximized = false;
    respond<Mp.ConfigChanged>("Main", "after-toggle-maximize", {config:config.data})
}

const onMaximize = () => {
    config.data.isMaximized = true;
    respond<Mp.ConfigChanged>("Main","after-toggle-maximize", {config:config.data})
}

const toggleMaximize = () => {

    if(renderer.Main.isMaximized()){
        renderer.Main.unmaximize();
        renderer.Main.setBounds(config.data.bounds)
    }else{
        config.data.bounds = renderer.Main.getBounds();
        renderer.Main.maximize();
    }
}

const saveConfig = (data:Mp.MediaState) => {

    try{
        config.data.isMaximized = renderer.Main.isMaximized();
        config.data.playlistBounds = renderer.Playlist.getBounds()
        config.save(data);
    }catch(ex){
        return showErrorMessage(ex);
    }
}

const closeWindow = (data:Mp.CloseRequest) => {
    saveConfig(data.mediaState);
    renderer.Playlist.close();
    renderer.Main.close();
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

    renderer.Main.setThumbarButtons([])

    if(mediaPlayStatus == "playing"){
        renderer.Main.setThumbarButtons(thumButtons[1])
    }else{
        renderer.Main.setThumbarButtons(thumButtons[0])
    }

}

const togglePlay = () => {
    respond("Main", "toggle-play", {})
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

    selectedFileIds.forEach(id => {
        delete fileMap[id];
    })

    const removeIndices = selectedFileIds.map(id => playlistFiles.map(e => e.id).indexOf(id))
    const isCurrentFileRemoved = removeIndices.includes(currentIndex);

    const newFiles = playlistFiles.filter(file => !selectedFileIds.includes(file.id));
    playlistFiles.length = 0;
    playlistFiles.push(...newFiles)

    respond<Mp.RemovePlaylistResult>("Playlist", "after-remove-playlist", {removedFileIds:selectedFileIds})

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

    respond<Mp.ReleaseFileRequest>("Main", "release-file", {fileIds:selectedFileIds})

}

const deleteFile = async () => {

    try{

        const targetFiles = selectedFileIds.map(id => fileMap[id].fullPath);

        await Promise.all(targetFiles.map(async item => await shell.trashItem(item)))

        removeFromPlaylist();

    }catch(ex){
        showErrorMessage(ex);
    }
}

const reveal = () => {

    if(!selectedFileIds.length || selectedFileIds.length > 1) return;

    const targetId = selectedFileIds[0];

    if(!fileMap[targetId]) return;

    proc.exec("explorer /e,/select," + fileMap[targetId].fullPath);
}

const openPlaylist = () => {
    config.data.playlistVisible = true;
    renderer.Playlist.show();
}

const openConvertDialog = () => {
    respond<Mp.MediaFile>("Convert", "before-open", getCurrentFile())
    renderer.Convert.show();
}

const openConvertSourceFileDialog = () => {
    const files = dialog.showOpenDialogSync(renderer.Convert, {
        title: "Select file to convert",
        defaultPath: getCurrentFile().fullPath,
        filters: [
            { name: "Media File", extensions: videoFormats.concat(audioFormats) },
        ],
        properties: ["openFile", "multiSelections"]
    })

    if(files){
        respond<Mp.FileSelectResult>("Convert", "after-sourcefile-select", {fullPath:files[0]})
    }
}

const copyFileNameToClipboard = () => {

    if(!selectedFileIds.length || selectedFileIds.length > 1) return;

    const targetId = selectedFileIds[0];

    if(!fileMap[targetId]) return;

    clipboard.writeText(fileMap[targetId].name);

}

const sortPlayList = (sortType:SortType, currentFile?:Mp.MediaFile) => {

    config.data.sortType = sortType;

    if(!playlistFiles.length) return;

    util.sort(playlistFiles, sortType)

    const sortedIds = playlistFiles.map(file => file.id);

    if(currentFile){
        currentIndex = sortedIds.findIndex(id => id === currentFile.id);
    }

    respond<Mp.SortResult>("Playlist", "after-sort", {fileIds:sortedIds})

}

const changePlaybackRate = (playbackRate:number) => {
    respond<Mp.ChangePlaySpeedRequest>("Main", "change-playback-rate", {playbackRate})
}

const changeSeekSpeed = (seekSpeed:number) => {
    respond<Mp.ChangePlaySpeedRequest>("Main", "change-seek-speed", {seekSpeed});
}

const saveImage = (data:Mp.SaveImageRequet) => {

    const savePath = dialog.showSaveDialogSync(renderer.Main, {
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

    const selectedPath = dialog.showSaveDialogSync(renderer.Convert, {
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

    renderer.Convert.hide()

    respond("Main", "toggle-convert", {})

    try{

        if(data.video){
            if(data.options.rotation !== "None"){
                await util.rotateVideo(data.sourcePath, savePath, data.options.rotation)
            }else{
                await util.convertVideo(data.sourcePath, savePath, data.options.frameSize)
            }
        }else{
            await util.extractAudio(data.sourcePath, savePath, data.options.bitrate)
        }

        if(shouldReplace){
            fs.renameSync(savePath, selectedPath)
        }

        onConvertEnd();

    }catch(ex:any){

        onConvertEnd(ex.message)

    }finally{

        openConvertDialog();
        respond("Main", "toggle-convert", {})

    }

}

const onConvertEnd = (message?:string) => {

    if(message){
        respond<Mp.ConvertResult>("Convert", "after-convert", {success:false, message})
    }else{
        respond<Mp.ConvertResult>("Convert", "after-convert", {success:true})
    }

}

const renameFile = async (data:Mp.RenameRequest) => {

    const oldFile = fileMap[data.id];
    const oldPath = oldFile.fullPath;
    const newPath = path.join(path.dirname(oldPath), data.name)

    try{

        if(util.exists(newPath)){
            throw new Error(`File name "${data.name}" exists`)
        }

        fs.renameSync(oldPath, newPath)

        const newMediaFile = util.updateFile(newPath, oldFile);
        const targetIndex = playlistFiles.findIndex(file => file.id == data.id)
        playlistFiles[targetIndex] = newMediaFile
        delete fileMap[data.id]
        fileMap[newMediaFile.id] = newMediaFile;
        data.id = newMediaFile.id;

        respond<Mp.RenameResult>("Playlist", "after-rename", {file:newMediaFile})

        if(targetIndex == currentIndex){
            respond<Mp.OnFileLoad>("Main", "on-file-load", {currentFile:newMediaFile, autoPlay:mediaPlayStatus == "playing"})
        }

    }catch(ex){
        await showErrorMessage(ex)
        respond<Mp.RenameResult>("Playlist", "after-rename", {file:oldFile, error:true})
    }
}

const onMinimize:handler<Mp.Args> = () => renderer.Main.minimize();

const onClose:handler<Mp.CloseRequest> = (_event:Electron.IpcMainEvent, data:Mp.CloseRequest) => closeWindow(data);

const onDrop:handler<Mp.DropRequest> = (_event:Electron.IpcMainEvent, data:Mp.DropRequest) => dropFiles(data);

const onLoadRequest:handler<Mp.LoadFileRequest> = (_event:Electron.IpcMainEvent, data:Mp.LoadFileRequest) => {
    if(data.isAbsolute){
        selectFile(data.index)
    }else{
        changeIndex(data.index)
    }
}

const onProgress:handler<Mp.OnProgress> = (_event:Electron.IpcMainEvent, data:Mp.OnProgress) => renderer.Main.setProgressBar(data.progress);

const onOpenMainContext:handler<Mp.Args> = () => mainContext.popup({window:renderer.Main});

const onPlayStatusChanged:handler<Mp.ChangePlayStatusRequest> = (_event:Electron.IpcMainEvent, data:Mp.ChangePlayStatusRequest) => changePlayStatus(data.status);

const onReload:handler<Mp.Args> = () => {
    renderer.Playlist.reload();
    renderer.Main.reload();
}

const onSaveImage:handler<Mp.SaveImageRequet> = (_event:Electron.IpcMainEvent, data:Mp.SaveImageRequet) => saveImage(data);

const onClosePlaylist:handler<Mp.Args> = () => {
    config.data.playlistVisible = false;
    renderer.Playlist.hide()
}

const onRemovePlaylistItem:handler<Mp.RemovePlaylistItemRequest> = (_event:Electron.IpcMainEvent, data:Mp.RemovePlaylistItemRequest) => {
    selectedFileIds = data.fileIds;
    removeFromPlaylist();
}

const onFileReleased = async () => {
    await deleteFile()
}

const onOpenPlaylistContext:handler<Mp.OpenPlaylistContextRequest> = (_event:Electron.IpcMainEvent, data:Mp.OpenPlaylistContextRequest) => {
    selectedFileIds = data.fileIds;
    playlistContext.popup({window:renderer.Playlist})
}

const onChangePlaylistOrder:handler<Mp.ChangePlaylistOrderRequet> = (_event:Electron.IpcMainEvent, data:Mp.ChangePlaylistOrderRequet) => movePlaylistFiles(data);

const onTogglePlay:handler<Mp.Args> = () => togglePlay();

const onToggleShuffle:handler<Mp.Args> = () => {
    doShuffle = !doShuffle;
    shuffleList();
}

const onToggleFullscreen:handler<Mp.Args> = () => {

    if(renderer.Main.isFullScreen()){
        renderer.Main.setFullScreen(false)
        if(config.data.playlistVisible) renderer.Playlist.show();
        renderer.Main.focus();
    }else{
        renderer.Main.setFullScreen(true)
        renderer.Playlist.hide();
    }
}

const onCloseConvertDiglog:handler<Mp.Args> = () => renderer.Convert.hide();

const onConnvertRequest:handler<Mp.ConvertRequest> = (_event:Electron.IpcMainEvent, data:Mp.ConvertRequest) => startConvert(data)

const onCancelConvertRequest:handler<Mp.Args> = () => util.cancelConvert();

const onOpenConvertSourceFileDialog:handler<Mp.Args> = () => openConvertSourceFileDialog();

const onRenameRequest:handler<Mp.RenameRequest> = async (_event:Electron.IpcMainEvent, data:Mp.RenameRequest) => await renameFile(data)