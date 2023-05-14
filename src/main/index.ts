import {app, BrowserWindow, ipcMain, clipboard, dialog, shell, screen, protocol} from "electron";
import fs from "fs";
import path from "path";
import proc from "child_process";
import url from "url"
import Helper from "./helper";
import Util from "./util";
import Config from "./config";
import { MainContextMenuTypes, PlaylistContextMenuTypes, ThumbButtonTypes } from "./enum";

protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { bypassCSP: true } },
])

let primaryDisplay:Electron.Display;
let mainWindow:Electron.CrossProcessExports.BrowserWindow | null;
let playlist:Electron.CrossProcessExports.BrowserWindow | null;
let tooltip:Electron.CrossProcessExports.BrowserWindow | null;

let invokedWithFiles = false;
let isReady = false;
let doShuffle = false;
let currentIndex = 0;
let selectedFileIds:string[] = [];
let randomIndices:number[] = [];
let fileMap:{[key:string]:Mp.MediaFile} = {}

const additionalFiles:string[] = [];
const orderedFiles:Mp.MediaFile[] = []
const FIT_TO_WINDOW_ITEM_INDEX = 1;
const helper = new Helper();
const util = new Util();
const config = new Config(app.getPath("userData"));

enum Renderer {
    Main,
    Playlist,
    Tooltip,
}

const thumButtons = helper.createThumButtons(thumbButtonCallback)

function thumbButtonCallback(button:ThumbButtonTypes){
    switch(button){
        case ThumbButtonTypes.Next:
            changeIndex(1);
            break;
        case ThumbButtonTypes.Pause:
            togglePlay();
            break;
        case ThumbButtonTypes.Play:
            togglePlay();
            break;
        case ThumbButtonTypes.Previous:
            changeIndex(-1)
            break;
    }
}

const mainContext = helper.createMainContextMenu(mainContextMenuCallback)

function mainContextMenuCallback(menu:MainContextMenuTypes){
    switch(menu){
        case MainContextMenuTypes.OpenPlaylist:
            openPlaylist();
            break;
        case MainContextMenuTypes.FitToWindow:
            changeSizeMode();
            break;
    }
}

function playlistContextMenuCallback(menu:PlaylistContextMenuTypes){
    switch(menu){
        case PlaylistContextMenuTypes.Remove:
            remove();
            break;
        case PlaylistContextMenuTypes.RemoveAll:
            removeAll();
            break;
        case PlaylistContextMenuTypes.Trash:
            beforeDelete();
            break;
        case PlaylistContextMenuTypes.CopyFileName:
            copyFileNameToClipboard();
            break;
        case PlaylistContextMenuTypes.Reveal:
            reveal();
            break;
        case PlaylistContextMenuTypes.NameAsc:
            sortPlayList(menu);
            break;
        case PlaylistContextMenuTypes.NameDesc:
            sortPlayList(menu);
            break;
        case PlaylistContextMenuTypes.DateAsc:
            sortPlayList(menu);
            break;
        case PlaylistContextMenuTypes.DateDesc:
            sortPlayList(menu);
            break;
    }
}

const playlistContext = helper.createPlaylistContextMenu(playlistContextMenuCallback)

const locked = app.requestSingleInstanceLock(process.argv);

if(!locked) {
    app.quit()
}

function onSecondInstanceReady(){
    tooltip.hide();
    reset();
    dropFiles({onPlaylist:false, files:[additionalFiles.shift()]})
    if(mainWindow.isMaximized){
        mainWindow.maximize();
    }
    mainWindow.show();
}

app.on("second-instance", (_event:Event, _argv:string[], _workingDirectory:string, additionalData:string[]) => {

    if(!isReady){
        additionalFiles.push(...util.extractFilesFromArgv(additionalData))
        return;
    }

    if(additionalFiles.length <= 0){

        additionalFiles.push(...util.extractFilesFromArgv(additionalData))
        setTimeout(() => {
            onSecondInstanceReady();
        }, 1000);

    }else{
        additionalFiles.push(...util.extractFilesFromArgv(additionalData))
    }

})

app.on("ready", async () => {

    invokedWithFiles = process.argv.length > 1 && process.argv[1] != ".";

    await init();

    protocol.registerFileProtocol("app", (request, callback) => {

        const filePath = url.fileURLToPath(
            "file://" + request.url.slice("app://".length),
        );

        callback(filePath);
    });

    primaryDisplay = screen.getPrimaryDisplay();

    mainWindow = new BrowserWindow({
        width: config.data.bounds.width,
        height: config.data.bounds.height,
        x:config.data.bounds.x,
        y:config.data.bounds.y,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, "..", "static", "img", "icon.ico"),
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
        },
    });

    mainWindow.on("ready-to-show", async () => {

        if(config.data.isMaximized){
            mainWindow.maximize();
        }

        mainWindow.setThumbarButtons(thumButtons[0])

        await onReady();

    })

    mainWindow.on("closed", () => {
        mainWindow = null
    });

    mainWindow.on("maximize", onMaximize);
    mainWindow.on("unmaximize", onUnmaximize);

    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

    playlist = new BrowserWindow({
        parent: mainWindow,
        backgroundColor: "#272626",
        width: config.data.playlistBounds.width,
        height: config.data.playlistBounds.height,
        x:config.data.playlistBounds.x,
        y:config.data.playlistBounds.y,
        autoHideMenuBar: true,
        show: false,
        frame:false,
        minimizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: PLAYLIST_WINDOW_PRELOAD_WEBPACK_ENTRY
        },
    })

    playlist.loadURL(PLAYLIST_WINDOW_WEBPACK_ENTRY);

    playlist.on("blur", () => tooltip.hide())

    tooltip = new BrowserWindow({
        parent: mainWindow,
        backgroundColor: "#272626",
        resizable: false,
        autoHideMenuBar: true,
        show: false,
        frame:false,
        minimizable: false,
        maximizable: false,
        thickFrame: false,
        focusable: false,
        transparent: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: TOOLTIP_WINDOW_PRELOAD_WEBPACK_ENTRY
        },
    })

    tooltip.loadURL(TOOLTIP_WINDOW_WEBPACK_ENTRY);

});

const init = async () => {

    await config.init();

    registerIpcChannels();
}

const registerIpcChannels = () => {

    const handlers:IpcMainHandler[] = [
        {channel:"minimize", handle:onMinimize},
        {channel:"toggle-maximize", handle:toggleMaximize},
        {channel:"close", handle:onClose},
        {channel:"drop", handle:onDrop},
        {channel:"load-file", handle:onLoadRequest},
        {channel:"progress", handle:onProgress},
        {channel:"open-main-context", handle:onOpenMainContext},
        {channel:"played", handle:onPlayStatusChanged},
        {channel:"paused", handle:onPlayStatusChanged},
        {channel:"reload", handle:onReload},
        {channel:"save-image", handle:onSaveImage},
        {channel:"close-playlist", handle:onClosePlaylist},
        {channel:"remove", handle:onRemove},
        {channel:"delete-file", handle:onDelete},
        {channel:"open-playlist-context", handle:onOpenPlaylistContext},
        {channel:"change-playlist-order", handle:onChangePlaylistOrder},
        {channel:"prepare-tooltip", handle:onPrepareTooltip},
        {channel:"show-tooltip", handle:onShowTooltip},
        {channel:"hide-tooltip", handle:onHideTooltip},
        {channel:"toggle-play", handle:onTogglePlay},
        {channel:"toggle-shuffle", handle:onToggleShuffle},
        {channel:"toggle-fullscreen", handle:onToggleFullscreen},
    ]

    handlers.forEach(handler => ipcMain.on(handler.channel, (event, request) => handler.handle(event, request)));
}

const respond = <T extends Mp.Args>(renderer:Renderer, channel:MainRendererChannel | PlaylistRendererChannel | TooltipRendererChannel, data:T) => {

    if(renderer === Renderer.Main){
        mainWindow.webContents.send(channel, data);
    }

    if(renderer === Renderer.Playlist){
        playlist.webContents.send(channel, data);
    }

    if(renderer === Renderer.Tooltip){
        tooltip.webContents.send(channel, data);
    }

}

const onReady = async () => {

    mainWindow.show();
    if(config.data.playlistVisible){
        playlist.show();
    }

    if(invokedWithFiles){
        await initFiles(util.extractFilesFromArgv())
    }else{
        reset()
    }

    isReady = true;

    mainContext.items[FIT_TO_WINDOW_ITEM_INDEX].checked = config.data.fitToWindow

    respond<Mp.Config>(Renderer.Main, "config", config.data);

    if(invokedWithFiles){
        respond<Mp.DropResult>(Renderer.Playlist, "after-drop", {clearPlaylist:false, files:orderedFiles})
        togglePlay();
    }

    loadResource(true);
}

const initFiles = async (files:string[]) => {

    reset();

    if(files.length <= 0) return;

    const targeFiles = files.concat(additionalFiles);

    for (const filepath of targeFiles) {
        const file = await util.toFile(filepath)
        orderedFiles.push(file)
        fileMap[file.id] = file;
    }

    currentIndex = 0;

    additionalFiles.length = 0;

    isReady = true;

}

const getCurrentFile = () => {

    if(currentIndex < 0) return null;

    return orderedFiles[currentIndex];

}

const reset = () => {
    orderedFiles.length = 0;
    randomIndices.length = 0;
    fileMap = {}
    currentIndex = -1;
    isReady = false;
    tooltip.hide();
    mainWindow.webContents.send("reset")
    playlist.webContents.send("reset")
}

const changeSizeMode = () => {
    config.data.fitToWindow = !config.data.fitToWindow
    mainContext.items[1].checked = config.data.fitToWindow
    respond<Mp.Config>(Renderer.Main, "change-display-mode", config.data)
}

const onUnmaximize = () => {
    config.data.isMaximized = false;
    respond<Mp.Config>(Renderer.Main, "after-toggle-maximize", config.data)
}

const onMaximize = () => {
    config.data.isMaximized = true;
    respond<Mp.Config>(Renderer.Main,"after-toggle-maximize", config.data)
}

const toggleMaximize = () => {
    if(mainWindow.isMaximized()){
        mainWindow.unmaximize();
    }else{
        mainWindow.maximize();
    }
}

const save = async (data:Mp.SaveRequest) => {

    config.data.isMaximized = mainWindow.isMaximized();
    const bounds = mainWindow.getBounds();
    config.data.bounds.width = bounds.width;
    config.data.bounds.height = bounds.height;
    config.data.bounds.x = bounds.x;
    config.data.bounds.y = bounds.y;
    const childBounds = playlist.getBounds();
    config.data.playlistBounds.width = childBounds.width;
    config.data.playlistBounds.height = childBounds.height;
    config.data.playlistBounds.x = childBounds.x;
    config.data.playlistBounds.y = childBounds.y;
    config.data.volume = data.mediaState.videoVolume;
    config.data.ampLevel = data.mediaState.ampLevel;
    config.data.fitToWindow = data.mediaState.fitToWindow;
    config.data.mute = data.mediaState.mute;

    try{
        await config.save();
    }catch(ex){
        return sendError(ex);
    }
}

const closeWindow = async (args:Mp.SaveRequest) => {
    await save(args);
    tooltip.close();
    playlist.close();
    mainWindow.close();
}

const shuffleList = () => {

    if(!doShuffle) return;

    const target = new Array(orderedFiles.length).fill(undefined).map((_v, i) => i).filter(i => i !== currentIndex);
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

    if(nextIndex >= orderedFiles.length){
        nextIndex = 0;
    }

    if(nextIndex < 0){
        nextIndex = orderedFiles.length - 1
    }

    currentIndex = nextIndex;

    loadResource(false);
}

const selectFile = (index:number) => {
    currentIndex = index;
    loadResource(true);
}

const loadResource = (autoPlay = false) => {
    const currentFile = getCurrentFile();
    respond<Mp.LoadFileResult>(Renderer.Playlist, "play", {currentFile, autoPlay})
    respond<Mp.LoadFileResult>(Renderer.Main, "play", {currentFile, autoPlay})
}

const toggleThumbButton = (played:boolean) => {

    mainWindow.setThumbarButtons([])

    if(played){
        mainWindow.setThumbarButtons(thumButtons[1])
    }else{
        mainWindow.setThumbarButtons(thumButtons[0])
    }

}

const togglePlay = () => {
    respond(Renderer.Main, "toggle-play", {})
}

const dropFiles = async (data:Mp.DropRequest) => {

    if(data.onPlaylist){

        await addFiles(data.files)

        shuffleList();

    }else{

        await initFiles(data.files)

        shuffleList();

        respond<Mp.DropResult>(Renderer.Playlist, "after-drop", {clearPlaylist:true, files:orderedFiles})

        loadResource(data.files.length == 1);

    }

}

const addFiles = async (filePaths:string[]) => {

    const changeCurrent = orderedFiles.length <= 0;

    const newFiles = (await Promise.all(filePaths.map(async (fullpath) => await util.toFile(fullpath)))).filter(file => !fileMap[file.id]);

    newFiles.forEach(file => {
        orderedFiles.push(file)
        fileMap[file.id] = file
    })

    respond<Mp.DropResult>(Renderer.Playlist, "after-drop", {clearPlaylist:false, files:newFiles})

    if(orderedFiles.length == 1 || changeCurrent){
        currentIndex = 0;
        loadResource(false);
    }
}

const changeOrder = (data:Mp.ChangePlaylistOrderRequet) => {

    if(data.start === data.end) return;

    const replacing = orderedFiles.splice(data.start, 1)[0];
    orderedFiles.splice(data.end, 0, replacing)

    currentIndex = data.currentIndex;
}

const removeAll = () => {

    reset();
    loadResource();
}

const remove = () => {

    if(!selectedFileIds.length) return;

    selectedFileIds.forEach(id => {
        delete fileMap[id];
    })

    const removeIndices = selectedFileIds.map(id => orderedFiles.map(e => e.id).indexOf(id))
    const shouldLoadNext = removeIndices.includes(currentIndex);

    const newFiles = orderedFiles.filter(file => !selectedFileIds.includes(file.id));
    orderedFiles.length = 0;
    orderedFiles.push(...newFiles)

    respond<Mp.RemovePlaylistResult>(Renderer.Playlist, "after-remove-playlist", {removedFileIds:selectedFileIds})

    currentIndex = getIndexAfterRemove(removeIndices)

    if(shouldLoadNext){

        loadResource(false);

    }

}

const getIndexAfterRemove = (removeIndices:number[]) => {

    if(removeIndices.includes(currentIndex)){

        const nextIndex = removeIndices[0]

        if(nextIndex >= orderedFiles.length){
            return orderedFiles.length - 1
        }

        return nextIndex;
    }

    if(removeIndices[0] < currentIndex){
        return currentIndex - removeIndices.length
    }

}

const beforeDelete = () => {

    if(selectedFileIds.length <= 0) return;

    respond<Mp.BeforeDeleteArg>(Renderer.Main, "before-delete", {releaseFile:selectedFileIds.includes(orderedFiles[currentIndex].id)})

}

const deleteFile = async () => {

    try{

        const targetFiles = selectedFileIds.map(id => fileMap[id].fullPath);

        await Promise.all(targetFiles.map(async item => await shell.trashItem(item)))

        remove();

    }catch(ex){
        sendError(ex);
    }
}

const reveal = () => {

    if(selectedFileIds.length <= 0 || selectedFileIds.length > 1) return;

    const targetId = selectedFileIds[0];

    if(!fileMap[targetId]) return;

    proc.exec("explorer /e,/select," + fileMap[targetId].fullPath);
}

const openPlaylist = () => {
    config.data.playlistVisible = true;
    playlist.show();
}

const copyFileNameToClipboard = () => {

    if(selectedFileIds.length <= 0 || selectedFileIds.length > 1) return;

    const targetId = selectedFileIds[0];

    if(!fileMap[targetId]) return;

    clipboard.writeText(fileMap[targetId].name);

}

const sortPlayList = (sortOrder:PlaylistContextMenuTypes) => {

    if(orderedFiles.length <= 0) return;

    const currentId = orderedFiles[currentIndex].id;

    switch(sortOrder){
        case PlaylistContextMenuTypes.NameAsc:
            orderedFiles.sort((a,b) => a.name.localeCompare(b.name))
            break;
        case PlaylistContextMenuTypes.NameDesc:
            orderedFiles.sort((a,b) => b.name.localeCompare(a.name))
            break;
        case PlaylistContextMenuTypes.DateAsc:
            orderedFiles.sort((a,b) => a.date - b.date)
            break;
        case PlaylistContextMenuTypes.DateDesc:
            orderedFiles.sort((a,b) => b.date - a.date)
            break;
    }

    const sortedIds = orderedFiles.map(file => file.id);
    currentIndex = sortedIds.findIndex(id => id === currentId);

    respond<Mp.SortResult>(Renderer.Playlist, "after-sort", {fileIds:sortedIds})

}

const sendError = (ex:any) => {
    respond<Mp.ErrorArgs>(Renderer.Main, "error", {message:ex.message})
}

const onMinimize:handler<Mp.SaveRequest> = (_event:Electron.IpcMainEvent, _data:Mp.SaveRequest) => mainWindow.minimize();

const onClose:handler<Mp.SaveRequest> = async (_event:Electron.IpcMainEvent, data:Mp.SaveRequest) => await closeWindow(data);

const onDrop:handler<Mp.DropRequest> = async (_event:Electron.IpcMainEvent, data:Mp.DropRequest) => await dropFiles(data);

const onLoadRequest:handler<Mp.LoadFileRequest> = (_event:Electron.IpcMainEvent, data:Mp.LoadFileRequest) => {
    if(data.isAbsolute){
        selectFile(data.index)
    }else{
        changeIndex(data.index)
    }
}

const onProgress:handler<Mp.ProgressArg> = (_event:Electron.IpcMainEvent, data:Mp.ProgressArg) => mainWindow.setProgressBar(data.progress);

const onOpenMainContext:handler<Mp.Args> = () => mainContext.popup({window:mainWindow});

const onPlayStatusChanged:handler<Mp.ChangePlayStatusRequest> = (_event:Electron.IpcMainEvent, data:Mp.ChangePlayStatusRequest) => toggleThumbButton(data.played);

const onReload:handler<Mp.Args> = () => {
    tooltip.hide();
    playlist.reload();
    mainWindow.reload();
}

const onSaveImage:handler<Mp.SaveImageRequet> = (_event:Electron.IpcMainEvent, data:Mp.SaveImageRequet) => {

    const saveSath = dialog.showSaveDialogSync(mainWindow, {
            defaultPath: `${getCurrentFile().name}-${data.timestamp}.jpeg`,
            filters: [
                { name: "Image", extensions: ["jpeg", "jpg"] },
            ],
    })

    if(!saveSath) return;

    fs.writeFileSync(saveSath, data.data, "base64")

}

const onClosePlaylist:handler<Mp.Args> = () => {
    config.data.playlistVisible = false;
    playlist.hide()
}

const onRemove:handler<Mp.RemovePlaylistRequest> = (_event:Electron.IpcMainEvent, data:Mp.RemovePlaylistRequest) => {
    selectedFileIds = data.selectedFileRange;
    remove();
}

const onDelete:handler<Mp.Args> = async () => await deleteFile();

const onOpenPlaylistContext:handler<Mp.OpenPlaylistContextRequest> = (_event:Electron.IpcMainEvent, data:Mp.OpenPlaylistContextRequest) => {
    tooltip.hide();
    selectedFileIds = data.selectedFileRange;
    playlistContext.popup({window:playlist})
}

const onChangePlaylistOrder:handler<Mp.ChangePlaylistOrderRequet> = (_event:Electron.IpcMainEvent, data:Mp.ChangePlaylistOrderRequet) => changeOrder(data);

const onPrepareTooltip:handler<Mp.PrepareTooltipRequest> = (_event:Electron.IpcMainEvent, data:Mp.PrepareTooltipRequest) => tooltip.webContents.send("prepare-tooltip", data);

const onShowTooltip:handler<Mp.ShowTooltipRequest> = (_event:Electron.IpcMainEvent, data:Mp.ShowTooltipRequest) => {

    const { width } = primaryDisplay.workAreaSize

    let x = data.position.x - 50
    if(x + (data.width + 20) >= width){
        x = width - (data.width + 20)
    }

    const y = data.position.y + 20;

    tooltip.setBounds({ x, y, width: data.width, height: data.height })
    if(!tooltip.isVisible()){
        tooltip.show();
    }
    tooltip.moveTop();
}

const onHideTooltip:handler<Mp.Args> = () => tooltip.hide();

const onTogglePlay:handler<Mp.Args> = () => togglePlay();

const onToggleShuffle:handler<Mp.Args> = () => {
    doShuffle = !doShuffle;
    shuffleList();
}

const onToggleFullscreen:handler<Mp.Args> = () => {

    tooltip.hide();

    if(mainWindow.isFullScreen()){
        mainWindow.setFullScreen(false)
        if(config.data.playlistVisible) playlist.show();
        mainWindow.focus();
    }else{
        mainWindow.setFullScreen(true)
        playlist.hide();
    }
}
