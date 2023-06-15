import {app, ipcMain, clipboard, dialog, shell, screen, protocol} from "electron";
import fs from "fs";
import path from "path";
import proc from "child_process";
import url from "url"
import Helper from "./helper";
import Util, {EmptyFile} from "./util";
import Config from "./config";
import { MainContextMenuTypes, PlaylistContextMenuTypes, ThumbButtonTypes } from "./enum";

// prevent monitor flickering
app.commandLine.appendSwitch("--disable-gpu");

protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { bypassCSP: true } },
])

const renderer:Renderer = {
    Main:null,
    Playlist:null,
    Tooltip:null,
    Convert:null,
}

const videoFormats = [
    "mp4",
    "mov",
    "avi",
    "wmv",
    "webm",
    "flv"
]

const audioFormats = [
    "wav",
    "mp3",
    "webm",
]

const additionalFiles:string[] = [];
const orderedFiles:Mp.MediaFile[] = []
const FIT_TO_WINDOW_ITEM_INDEX = 1;
const helper = new Helper();
const util = new Util();
const config = new Config(app.getPath("userData"));

let primaryDisplay:Electron.Display;

let invokedWithFiles = false;
let isReady = false;
let doShuffle = false;
let currentIndex = 0;
let selectedFileIds:string[] = [];
let randomIndices:number[] = [];
let fileMap:{[key:string]:Mp.MediaFile} = {}

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

function mainContextMenuCallback(menu:MainContextMenuTypes, args?:any){
    switch(menu){
        case MainContextMenuTypes.PlaybackRate:
            changePlaybackRate(args);
            break;
        case MainContextMenuTypes.SeekSpeed:
            changeSeekSpeed(args);
            break;
        case MainContextMenuTypes.Convert:
            openConvertDialog();
            break;
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
    renderer.Tooltip.hide();
    reset();
    dropFiles({onPlaylist:false, files:[additionalFiles.shift()]})
    if(renderer.Main.isMaximized){
        renderer.Main.maximize();
    }
    renderer.Main.show();
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

    renderer.Main = helper.createMainWindow(config.data)

    renderer.Main.on("ready-to-show", async () => {

        if(config.data.isMaximized){
            renderer.Main.maximize();
        }

        renderer.Main.setThumbarButtons(thumButtons[0])

        await onReady();

    })

    renderer.Main.on("closed", () => {
        renderer.Main = null
    });

    renderer.Main.on("maximize", onMaximize);
    renderer.Main.on("unmaximize", onUnmaximize);

    renderer.Playlist = helper.createPlaylistWindow(renderer.Main, config.data)

    renderer.Playlist.on("blur", () => renderer.Tooltip.hide())

    renderer.Tooltip = helper.createTooltipWindow(renderer.Main)

    renderer.Convert = helper.createConvertWindow(renderer.Main)

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
        {channel:"close-convert", handle:onCloseConvertDiglog},
        {channel:"request-convert", handle:onConnvertRequest},
        {channel:"request-cancel-convert", handle:onCancelConvertRequest},
        {channel: "open-convert-sourcefile-dialog", handle:onOpenConvertSourceFileDialog}
    ]

    handlers.forEach(handler => ipcMain.on(handler.channel, (event, request) => handler.handle(event, request)));
}

const respond = <T extends Mp.Args>(rendererName:RendererName, channel:RendererChannel, data:T) => {

    renderer[rendererName].webContents.send(channel, data);

}

const onReady = async () => {

    renderer.Main.show();
    if(config.data.playlistVisible){
        renderer.Playlist.show();
    }

    if(invokedWithFiles){
        await initFiles(util.extractFilesFromArgv())
    }else{
        reset()
    }

    isReady = true;

    mainContext.items[FIT_TO_WINDOW_ITEM_INDEX].checked = config.data.video.fitToWindow

    respond<Mp.Config>("Main", "config", config.data);

    if(invokedWithFiles){
        respond<Mp.DropResult>("Playlist", "after-drop", {clearPlaylist:false, files:orderedFiles})
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

    if(currentIndex < 0) return EmptyFile;

    return orderedFiles[currentIndex];

}

const reset = () => {
    orderedFiles.length = 0;
    randomIndices.length = 0;
    fileMap = {}
    currentIndex = -1;
    isReady = false;
    renderer.Tooltip.hide();
    renderer.Main.webContents.send("reset")
    renderer.Playlist.webContents.send("reset")
}

const changeSizeMode = () => {
    config.data.video.fitToWindow = !config.data.video.fitToWindow
    mainContext.items[1].checked = config.data.video.fitToWindow
    respond<Mp.Config>("Main", "change-display-mode", config.data)
}

const onUnmaximize = () => {
    config.data.isMaximized = false;
    respond<Mp.Config>("Main", "after-toggle-maximize", config.data)
}

const onMaximize = () => {
    config.data.isMaximized = true;
    respond<Mp.Config>("Main","after-toggle-maximize", config.data)
}

const toggleMaximize = () => {
    if(renderer.Main.isMaximized()){
        renderer.Main.unmaximize();
    }else{
        renderer.Main.maximize();
    }
}

const save = async (data:Mp.SaveRequest) => {

    try{
        await config.save(data, renderer.Main.isMaximized(), renderer.Main.getBounds(), renderer.Playlist.getBounds());
    }catch(ex){
        return sendError(ex);
    }
}

const closeWindow = async (args:Mp.SaveRequest) => {
    await save(args);
    renderer.Tooltip.close();
    renderer.Playlist.close();
    renderer.Main.close();
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
    respond<Mp.LoadFileResult>("Playlist", "play", {currentFile, autoPlay})
    respond<Mp.LoadFileResult>("Main", "play", {currentFile, autoPlay})
}

const toggleThumbButton = (played:boolean) => {

    renderer.Main.setThumbarButtons([])

    if(played){
        renderer.Main.setThumbarButtons(thumButtons[1])
    }else{
        renderer.Main.setThumbarButtons(thumButtons[0])
    }

}

const togglePlay = () => {
    respond("Main", "toggle-play", {})
}

const dropFiles = async (data:Mp.DropRequest) => {

    if(data.onPlaylist){

        await addFiles(data.files)

        shuffleList();

    }else{

        await initFiles(data.files)

        shuffleList();

        respond<Mp.DropResult>("Playlist", "after-drop", {clearPlaylist:true, files:orderedFiles})

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

    respond<Mp.DropResult>("Playlist", "after-drop", {clearPlaylist:false, files:newFiles})

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

    respond<Mp.RemovePlaylistResult>("Playlist", "after-remove-playlist", {removedFileIds:selectedFileIds})

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

    respond<Mp.BeforeDeleteArg>("Main", "before-delete", {shouldReleaseFile:selectedFileIds.includes(orderedFiles[currentIndex].id)})

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

    if(selectedFileIds.length <= 0 || selectedFileIds.length > 1) return;

    const targetId = selectedFileIds[0];

    if(!fileMap[targetId]) return;

    clipboard.writeText(fileMap[targetId].name);

}

const sortPlayList = (sortOrder:PlaylistContextMenuTypes) => {

    if(!orderedFiles.length) return;

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

    respond<Mp.SortResult>("Playlist", "after-sort", {fileIds:sortedIds})

}

const changePlaybackRate = (playbackRate:number) => {
    respond<Mp.ChangePlaySpeed>("Main", "change-playback-rate", {playbackRate})
}

const changeSeekSpeed = (seekSpeed:number) => {
    respond<Mp.ChangePlaySpeed>("Main", "change-seek-speed", {seekSpeed});
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

    const fileExists = await util.exists(data.sourcePath)

    if(!fileExists) return onConvertEnd();

    const extension = data.video ? "mp4" : "mp3"
    const name = data.video ? "Video" : "Audio"

    const file = await util.toFile(data.sourcePath);
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

const sendError = (ex:any) => {
    respond<Mp.ErrorArgs>("Main", "error", {message:ex.message})
}

const onMinimize:handler<Mp.SaveRequest> = (_event:Electron.IpcMainEvent, _data:Mp.SaveRequest) => renderer.Main.minimize();

const onClose:handler<Mp.SaveRequest> = async (_event:Electron.IpcMainEvent, data:Mp.SaveRequest) => await closeWindow(data);

const onDrop:handler<Mp.DropRequest> = async (_event:Electron.IpcMainEvent, data:Mp.DropRequest) => await dropFiles(data);

const onLoadRequest:handler<Mp.LoadFileRequest> = (_event:Electron.IpcMainEvent, data:Mp.LoadFileRequest) => {
    if(data.isAbsolute){
        selectFile(data.index)
    }else{
        changeIndex(data.index)
    }
}

const onProgress:handler<Mp.ProgressArg> = (_event:Electron.IpcMainEvent, data:Mp.ProgressArg) => renderer.Main.setProgressBar(data.progress);

const onOpenMainContext:handler<Mp.Args> = () => mainContext.popup({window:renderer.Main});

const onPlayStatusChanged:handler<Mp.ChangePlayStatusRequest> = (_event:Electron.IpcMainEvent, data:Mp.ChangePlayStatusRequest) => toggleThumbButton(data.played);

const onReload:handler<Mp.Args> = () => {
    renderer.Tooltip.hide();
    renderer.Playlist.reload();
    renderer.Main.reload();
}

const onSaveImage:handler<Mp.SaveImageRequet> = (_event:Electron.IpcMainEvent, data:Mp.SaveImageRequet) => saveImage(data);

const onClosePlaylist:handler<Mp.Args> = () => {
    config.data.playlistVisible = false;
    renderer.Playlist.hide()
}

const onRemove:handler<Mp.RemovePlaylistRequest> = (_event:Electron.IpcMainEvent, data:Mp.RemovePlaylistRequest) => {
    selectedFileIds = data.selectedFileRange;
    remove();
}

const onDelete:handler<Mp.Args> = async () => await deleteFile();

const onOpenPlaylistContext:handler<Mp.OpenPlaylistContextRequest> = (_event:Electron.IpcMainEvent, data:Mp.OpenPlaylistContextRequest) => {
    renderer.Tooltip.hide();
    selectedFileIds = data.selectedFileRange;
    playlistContext.popup({window:renderer.Playlist})
}

const onChangePlaylistOrder:handler<Mp.ChangePlaylistOrderRequet> = (_event:Electron.IpcMainEvent, data:Mp.ChangePlaylistOrderRequet) => changeOrder(data);

const onPrepareTooltip:handler<Mp.PrepareTooltipRequest> = (_event:Electron.IpcMainEvent, data:Mp.PrepareTooltipRequest) => renderer.Tooltip.webContents.send("prepare-renderer.Tooltip", data);

const onShowTooltip:handler<Mp.ShowTooltipRequest> = (_event:Electron.IpcMainEvent, data:Mp.ShowTooltipRequest) => {

    const { width } = primaryDisplay.workAreaSize

    let x = data.position.x - 50
    if(x + (data.width + 20) >= width){
        x = width - (data.width + 20)
    }

    const y = data.position.y + 20;

    renderer.Tooltip.setBounds({ x, y, width: data.width, height: data.height })
    if(!renderer.Tooltip.isVisible()){
        renderer.Tooltip.show();
    }
    renderer.Tooltip.moveTop();
}

const onHideTooltip:handler<Mp.Args> = () => renderer.Tooltip.hide();

const onTogglePlay:handler<Mp.Args> = () => togglePlay();

const onToggleShuffle:handler<Mp.Args> = () => {
    doShuffle = !doShuffle;
    shuffleList();
}

const onToggleFullscreen:handler<Mp.Args> = () => {

    renderer.Tooltip.hide();

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

const onConnvertRequest:handler<Mp.ConvertRequest> = (_event:Electron.IpcMainEvent, data:Mp.ConvertRequest) => {
    startConvert(data)
}

const onCancelConvertRequest:handler<Mp.Args> = () => util.cancelConvert();

const onOpenConvertSourceFileDialog:handler<Mp.Args> = () => openConvertSourceFileDialog();