const {app, BrowserWindow, ipcMain, Menu, globalShortcut} = require("electron");
const path = require("path");
const trash = require("trash");
const fs = require("fs").promises;
const proc = require("child_process");

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

const mainMenuTemplate = [
    {
        label: "Open playlist",
        click: () => openPlayList()
    }
]

const mainMenu = Menu.buildFromTemplate(mainMenuTemplate)

const playlistMenuTemplate = [
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
        label: "Reveal in File Explorer",
        click: () => reveal()
    },
]

const playlistMenu = Menu.buildFromTemplate(playlistMenuTemplate)

let mainWindow;
let playlist;
let tooltip;
let directLaunch;
let config;

let isReady = false;
let currentIndex = 0;
let targets;
let fileMap = {}

const additionalFiles = [];
const orderedFiles = []

const locked = app.requestSingleInstanceLock(process.argv);

if(!locked) {
    app.quit()
    return;
}

app.on("second-instance", (event, argv, workingDirectory, additionalData) => {

    if(!isReady){
        additionalFiles.push(...extractFiles(additionalData))
        return;
    }

    if(additionalFiles.length <= 0){

        additionalFiles.push(...extractFiles(additionalData))
        setTimeout(() => {
            dropFiles({playlist:false, files:[additionalFiles.shift()]})
        }, 1000);

    }else{
        additionalFiles.push(...extractFiles(additionalData))
    }

})

app.on("ready", async () => {

    globalShortcut.register("F5", () => {
        mainWindow.reload();
        playlist.reload();
    })

    directLaunch = process.argv.length > 1 && process.argv[1] != "main.js";

    currentDirectory = path.join(app.getPath("userData"), "temp");

    await init();

    mainWindow = new BrowserWindow({
        width: config.bounds.width,
        height: config.bounds.height,
        x:config.bounds.x,
        y:config.bounds.y,
        autoHideMenuBar: true,
        show: false,
        icon: "./resources/icon2.png",
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
    }else{
        config = {volume:1, ampLevel:0, bounds:{width:1200, height:800, isMaximized: false, x:0, y:0}, subbounds:{width:400, height:700, x:0, y:0}}
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

    mainWindow.webContents.send("config", {config});
    playlist.webContents.send("change-list", {clear:false, files:orderedFiles})
    loadVide(true);
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
}

function toFile(fullpath){
    return {id:encodeURIComponent(fullpath), path:fullpath, name:decodeURIComponent(encodeURIComponent(path.basename(fullpath)))}
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

function changeIndex(index){

    const nextIndex = currentIndex + index;

    if(nextIndex >= orderedFiles.length || nextIndex < 0){
        return;
    }

    currentIndex = nextIndex;

    loadVide(false);
}

function selectFile(index){

    currentIndex = index;
    loadVide(true);

}

function loadVide(play = false){
    playlist.webContents.send("play", {current:getCurrentFile()})
    mainWindow.webContents.send("play", {current:getCurrentFile(), play});
}

function toggleThumbButton(){
    [[thumButtons[0], thumButtons[1]]] = [[thumButtons[1], thumButtons[0]]]

    mainWindow.setThumbarButtons([])
    mainWindow.setThumbarButtons(thumButtons[0])
}

function togglePlay(){
    mainWindow.webContents.send("toggle-play");
}

function dropFiles(data){

    let newFiles;

    if(!data.playlist){
        initFiles(data.files)
        playlist.webContents.send("change-list", {clear:true, files:orderedFiles})
        loadVide(data.files.length == 1);
    }else{
        newFiles = data.files.map(file => toFile(file)).filter(file => !fileMap[file.id]);
        orderedFiles.push(...newFiles)
        playlist.webContents.send("change-list", {clear:false, files:newFiles})
        if(orderedFiles.length == 1){
            currentIndex = 0;
            loadVide(false);
        }
    }

}

function changeOrder(data){

    if(data.start === data.end) return;

    const replacing = orderedFiles.splice(data.start, 1)[0];
    orderedFiles.splice(data.end, 0, replacing)

    currentIndex = data.end;
}

function removeAll(){

    reset();

    playlist.webContents.send("change-list", {clear:true, files:orderedFiles})

    loadVide();
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

        loadVide(true);

    }

}

async function deleteFile(){

    if(targets.length <= 0) return;

    try{

        if(targets.includes(currentIndex)){
            mainWindow.webContents.send("clear-current");
        }

        const targetFiles = targets.map(index => orderedFiles[index].path);

        await trash(targetFiles);

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

function openPlayList(){
    playlist.show();
}

function sendError(ex){
    mainWindow.webContents.send("error", {message:ex.message})
}

ipcMain.on("minimize", (e, data) => {
    mainWindow.minimize();
});

ipcMain.on("toggleMaximize", (e, data) => {
    toggleMaximize();
});

ipcMain.on("toggle-thumb", (e, data) => {
    toggleThumbButton();
})

ipcMain.on("close", (e, data) => {
    closeWindow(data);
});

ipcMain.on("selectFile", (e, data) => {
    selectFile(data.index)
})

ipcMain.on("changeIndex", (e, data) => {
    changeIndex(data.index)
})

ipcMain.on("drop", (e, data) => {
    dropFiles(data);
})

ipcMain.on("progress", (e, data) =>{
    mainWindow.setProgressBar(data.progress);
})

ipcMain.on("changeOrder", (e, data) => {
    changeOrder(data);
})

ipcMain.on("remove", (e, data) => {
    targets = data.targets;
    remove();
})

ipcMain.on("main-context", (e, data) => {
    mainMenu.popup(mainWindow)
})

ipcMain.on("close-playlist", (e,data) => {
    playlist.hide();
})

ipcMain.on("playlist-context", (e, data) => {
    tooltip.hide();
    targets = data.targets;
    playlistMenu.popup(playlist)
})

ipcMain.on("show-tooltip", (e ,data) => {
    tooltip.webContents.send("change-content", data)
})

ipcMain.on("content-set", (e, data) => {

    const bounds = mainWindow.getBounds();

    let x = data.x - 50
    if(x + (data.width + 20) >= bounds.width){
        x = bounds.width - (data.width + 20)
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