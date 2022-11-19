const {app, BrowserWindow, ipcMain, Menu, clipboard, dialog, shell, screen } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const proc = require("child_process");

let primaryDisplay;
let mainWindow;
let playlist;
let tooltip;
let directLaunch;

let isReady = false;
let doShuffle = false;
let currentIndex = 0;
let targets;
let fileMap = {}

const additionalFiles = [];
const orderedFiles = []

const defaultConfig = {
    volume: 1,
    ampLevel: 0,
    fitToWindow: true,
    bounds: {width:1200, height:800, isMaximized: false, x:0, y:0},
    subbounds: {width:400, height:700, x:0, y:0},
}

let config = defaultConfig;

const playThumbButton = {
    tooltip: "Play",
    icon: path.join(__dirname, "resources", "play.png"),
    click: () => togglePlay(),
}
const pauseThumbButton = {
    tooltip: "Pause",
    icon: path.join(__dirname, "resources", "pause.png"),
    click: () => togglePlay(),
}
const prevThumbButton = {
    tooltip: "Previous",
    icon: path.join(__dirname, "resources", "backward.png"),
    click: () => changeIndex(-1)
}
const nextThumbButton = {
    tooltip: "Next",
    icon: path.join(__dirname, "resources", "forward.png"),
    click: () => changeIndex(1)
}

const thumbButtonsOptionsPaused = [
    prevThumbButton,
    playThumbButton,
    nextThumbButton
]

const thumbButtonsOptionsPlayed = [
    prevThumbButton,
    pauseThumbButton,
    nextThumbButton
]

const thumButtons = [
    thumbButtonsOptionsPaused,
    thumbButtonsOptionsPlayed
]

const mainContextTemplate = [
    {
        label: "Open Playlist",
        click: () => openPlaylist()
    },
    {
        label: "Fit To Window Size",
        type: "checkbox",
        checked: defaultConfig.fitToWindow,
        click: () => changeSizeMode(),
    },
]

const FIT_TO_WINDOW_ITEM_INDEX = 1;

const mainContext = Menu.buildFromTemplate(mainContextTemplate)

const playlistContextTemplate = [
    {
        label: "Remove",
        click: () => remove()
    },
    {
        label: "Remove all",
        click: () => removeAll()
    },
    {
        label: "Trash",
        click: () => deleteFile()
    },
    { type: "separator" },
    {
        label: "Copy File Name",
        click: () => copyFileNameToClipboard()
    },
    {
        label: "Reveal in File Explorer",
        click: () => reveal()
    },
]

const playlistContext = Menu.buildFromTemplate(playlistContextTemplate)

const locked = app.requestSingleInstanceLock(process.argv);

if(!locked) {
    app.quit()
    return;
}

function onSecondInstanceReady(){
    tooltip.hide();
    reset();
    dropFiles({playlist:false, files:[additionalFiles.shift()]})
    if(mainWindow.isMaximized){
        mainWindow.maximize();
    }
    mainWindow.show();
}

app.on("second-instance", (event, argv, workingDirectory, additionalData) => {

    if(!isReady){
        additionalFiles.push(...extractFiles(additionalData))
        return;
    }

    if(additionalFiles.length <= 0){

        additionalFiles.push(...extractFiles(additionalData))
        setTimeout(() => {
            onSecondInstanceReady();
        }, 1000);

    }else{
        additionalFiles.push(...extractFiles(additionalData))
    }

})

app.on("ready", async () => {

    directLaunch = process.argv.length > 1 && process.argv[1] != "./src/main.js";

    currentDirectory = path.join(app.getPath("userData"), "temp");

    await init();

    primaryDisplay = screen.getPrimaryDisplay();

    mainWindow = new BrowserWindow({
        width: config.bounds.width,
        height: config.bounds.height,
        x:config.bounds.x,
        y:config.bounds.y,
        autoHideMenuBar: true,
        show: false,
        icon: "./resources/icon.ico",
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, "preload.js")
        },
    });

    mainWindow.on("ready-to-show", () => {

        if(config.bounds.isMaximized){
            mainWindow.maximize();
        }

        mainWindow.setThumbarButtons(thumButtons[0])

        onReady();

    })

    mainWindow.on("closed", function() {
        mainWindow = null;
    });

    mainWindow.loadURL("file://" + __dirname + "/index.html");

    playlist = new BrowserWindow({
        parent: mainWindow,
        backgroundColor: "#272626",
        width: config.subbounds.width,
        height: config.subbounds.height,
        x:config.subbounds.x,
        y:config.subbounds.y,
        autoHideMenuBar: true,
        show: false,
        frame:false,
        minimizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, "playlistPreload.js")
        },
    })

    playlist.loadURL("file://" + __dirname + "/playlist.html");

    playlist.on("blur", e => tooltip.hide())

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
            enableRemoteModule: false,
            preload: path.join(__dirname, "tooltipPreload.js")
        },
    })

    tooltip.loadURL("file://" + __dirname + "/tooltip.html");

});

async function init(){

    await exists(currentDirectory, true);

    const configFilePath = path.join(currentDirectory,"vidplayer.config.json");

    const fileExists = await exists(configFilePath, false);

    if(fileExists){
        const rawData = await fs.readFile(configFilePath, {encoding:"utf8"});
        config = JSON.parse(rawData);
        Object.keys(defaultConfig).forEach(key => {
            if(!config.hasOwnProperty(key)){
                config[key] = defaultConfig[key];
            }
        })
    }else{
        config = defaultConfig;
        await writeConfig()
    }
}

async function exists(target, createIfNotFound = false){

    try{
        await fs.stat(target);

        return true;

    }catch(ex){

        if(createIfNotFound){
            await fs.mkdir(target);
        }

        return false;
    }
}

async function onReady(){

    mainWindow.show();
    playlist.show();

    if(directLaunch){
        initFiles(extractFiles())
    }else{
        reset()
    }

    isReady = true;

    mainContext.items[FIT_TO_WINDOW_ITEM_INDEX].checked = config.fitToWindow
    mainWindow.webContents.send("config", {config});

    if(directLaunch){
        playlist.webContents.send("change-list", {clear:false, files:orderedFiles})
        togglePlay();
    }

    loadResource(true);
}

function extractFiles(target){

    if(target){
        return target.slice(1, target.length)
    }

    return process.argv.slice(1, process.argv.length)
}

function initFiles(files){

    reset();

    if(files.length <= 0) return;

    const targeFiles = files.concat(additionalFiles);

    targeFiles.forEach(filepath => {
        const file = toFile(filepath)
        orderedFiles.push(file)
        fileMap[file.id] = file;
    });

    currentIndex = 0;

    additionalFiles.length = 0;

    isReady = true;
}

function getCurrentFile(){

    if(currentIndex < 0) return null;

    return orderedFiles[currentIndex];

}

function reset(){
    orderedFiles.length = 0;
    fileMap = {}
    currentIndex = -1;
    isReady = false;
    tooltip.hide();
    mainWindow.webContents.send("reset")
    playlist.webContents.send("reset")
}

function toFile(fullpath){

    //const statInfo = fs.statSync(fullpath);
    const encodedPath = path.join(path.dirname(fullpath), encodeURIComponent(path.basename(fullpath)))

    return {id:encodeURIComponent(fullpath), path:fullpath, src:encodedPath, name:decodeURIComponent(encodeURIComponent(path.basename(fullpath)))}
}

function changeSizeMode(){
    config.fitToWindow = !config.fitToWindow
    mainContext.items[1].checked = config.fitToWindow
    mainWindow.webContents.send("change-size-mode", {fitToWindow:config.fitToWindow})
}

async function writeConfig(){
    try{
        await fs.writeFile(path.join(currentDirectory,"vidplayer.config.json"), JSON.stringify(config));
    }catch(ex){
        sendError(ex);
    }
}

function toggleMaximize(){

    if(mainWindow.isMaximized()){
        mainWindow.unmaximize();
        config.bounds.isMaximized = false;
    }else{
        mainWindow.maximize();
        config.bounds.isMaximized = true;
    }

    mainWindow.webContents.send("afterToggleMaximize", {isMaximized: config.bounds.isMaximized});
}

async function save(props){

    config.bounds.isMaximized = mainWindow.isMaximized();
    const bounds = mainWindow.getBounds();
    config.bounds.width = bounds.width;
    config.bounds.height = bounds.height;
    config.bounds.x = bounds.x;
    config.bounds.y = bounds.y;
    const childBounds = playlist.getBounds();
    config.subbounds.width = childBounds.width;
    config.subbounds.height = childBounds.height;
    config.subbounds.x = childBounds.x;
    config.subbounds.y = childBounds.y;
    config.volume = props.volume;
    config.ampLevel = props.ampLevel;

    try{
        await writeConfig();
    }catch(ex){
        return sendError(ex);
    }
}

async function closeWindow(args){
    await save(args);
    tooltip.close();
    playlist.close();
    mainWindow.close();
}

function getRandomIndex(){
    const index = Math.floor(Math.random() * orderedFiles.length)

    if(index === currentIndex){
        return getRandomIndex();
    }else{
        return index;
    }
}

function changeIndex(index){

    let nextIndex = doShuffle ? getRandomIndex() : currentIndex + index;

    if(nextIndex >= orderedFiles.length){
        nextIndex = 0;
    }

    if(nextIndex < 0){
        nextIndex = orderedFiles.length - 1
    }

    currentIndex = nextIndex;

    loadResource(false);
}

function selectFile(index){

    currentIndex = index;
    loadResource(true);

}

function loadResource(play = false){
    const current = getCurrentFile();
    playlist.webContents.send("play", {current})
    mainWindow.webContents.send("play", {current, play});
}

function toggleThumbButton(played){

    mainWindow.setThumbarButtons([])

    if(played){
        mainWindow.setThumbarButtons(thumButtons[1])
    }else{
        mainWindow.setThumbarButtons(thumButtons[0])
    }

}

function togglePlay(){
    mainWindow.webContents.send("toggle-play");
}

function dropFiles(data){

    if(data.playlist){

        const changeCurrent = orderedFiles.length <= 0;

        const newFiles = data.files.map(file => toFile(file)).filter(file => !fileMap[file.id]);

        newFiles.forEach(file => {
            orderedFiles.push(file)
            fileMap[file.id] = file
        })

        playlist.webContents.send("change-list", {clear:false, files:newFiles})

        if(orderedFiles.length == 1 || changeCurrent){
            currentIndex = 0;
            loadResource(false);
        }

        return
    }

    initFiles(data.files)
    playlist.webContents.send("change-list", {clear:true, files:orderedFiles})
    loadResource(data.files.length == 1);

}

function changeOrder(data){

    if(data.start === data.end) return;

    const replacing = orderedFiles.splice(data.start, 1)[0];
    orderedFiles.splice(data.end, 0, replacing)

    currentIndex = data.currentIndex;
}

function removeAll(){

    reset();

    playlist.webContents.send("change-list", {clear:true, files:orderedFiles})

    loadResource();
}

function remove(){

    if(targets.length <= 0) return;

    targets.forEach(index => {
        const file = orderedFiles[index];
        delete fileMap[file.id];
    })

    const newFiles = orderedFiles.filter((_, index) => !targets.includes(index));;
    orderedFiles.length = 0;
    orderedFiles.push(...newFiles)

    playlist.webContents.send("removed", {targets})

    if(targets.includes(currentIndex)){

        if(targets[0] < orderedFiles.length){
            currentIndex = targets[0]
        }else{
            currentIndex = targets[0] - 1
        }

        loadResource(false);

    }

}

async function deleteFile(){

    if(targets.length <= 0) return;

    try{

        if(targets.includes(currentIndex)){
            mainWindow.webContents.send("release-file");
        }

        const targetFiles = targets.map(index => orderedFiles[index].path);

        await Promise.all(targetFiles.map(async item => await shell.trashItem(item)))

        remove();

    }catch(ex){
        sendError(ex);
    }
}

function reveal(){

    if(targets.length <= 0 || targets.length > 1) return;

    const index = targets[0];

    if(!orderedFiles[index]) return;

    proc.exec("explorer /e,/select," + orderedFiles[index].path);
}

function openPlaylist(){
    playlist.show();
}

function copyFileNameToClipboard(){
    const current = getCurrentFile();
    if(current){
        clipboard.writeText(current.name);
    }
}

function sendError(ex){
    mainWindow.webContents.send("error", {message:ex.message})
}

ipcMain.on("minimize", (e, data) => {
    mainWindow.minimize();
});

ipcMain.on("toggle-maximize", (e, data) => {
    toggleMaximize();
});

ipcMain.on("played", (e, data) => {
    toggleThumbButton(true);
})

ipcMain.on("paused", (e, data) => {
    toggleThumbButton(false);
})

ipcMain.on("close", (e, data) => {
    closeWindow(data);
});

ipcMain.on("select-file", (e, data) => {
    selectFile(data.index)
})

ipcMain.on("change-index", (e, data) => {
    changeIndex(data.index)
})

ipcMain.on("drop", (e, data) => {
    dropFiles(data);
})

ipcMain.on("progress", (e, data) =>{
    mainWindow.setProgressBar(data.progress);
})

ipcMain.on("change-order", (e, data) => {
    changeOrder(data);
})

ipcMain.on("remove", (e, data) => {
    targets = data.targets;
    remove();
})

ipcMain.on("main-context", (e, data) => {
    mainContext.popup(mainWindow)
})

ipcMain.on("close-playlist", (e,data) => {
    playlist.hide();
})

ipcMain.on("playlist-context", (e, data) => {
    tooltip.hide();
    targets = data.targets;
    playlistContext.popup(playlist)
})

ipcMain.on("show-tooltip", (e ,data) => {
    tooltip.webContents.send("change-content", data)
})

ipcMain.on("content-set", (e, data) => {

    const { width } = primaryDisplay.workAreaSize

    let x = data.x - 50
    if(x + (data.width + 20) >= width){
        x = width - (data.width + 20)
    }

    const y = data.y + 20;

    tooltip.setBounds({ x, y, width: data.width, height: data.height })
    if(!tooltip.isVisible()){
        tooltip.show();
    }
    tooltip.moveTop();
})

ipcMain.on("hide-tooltip", (e, data) => {
    tooltip.hide();
})

ipcMain.on("save-image", async (e, data) => {

    const saveSath = dialog.showSaveDialogSync(mainWindow, {
        defaultPath: `${getCurrentFile().name}-${data.timestamp}.jpeg`,
        filters: [
            { name: 'Image', extensions: ['jpeg', 'jpg'] },
        ],
    })

    if(!saveSath) return;

    await fs.writeFile(saveSath, data.data, "base64")
})

ipcMain.on("playlist-toggle-play", () => {
    togglePlay();
})

ipcMain.on("toggle-shuffle", () => {
    doShuffle = !doShuffle
})

ipcMain.on("reload", (e,data) => {
    tooltip.hide();
    playlist.reload();
    mainWindow.reload();
})