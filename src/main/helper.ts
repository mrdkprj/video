import { BrowserWindow, Menu, nativeImage } from "electron"
import path from "path"
//./ffmpeg.exe -i input.mp4 -metadata comment="The video titile" -c copy output.mp4
export default class Helper{

    createMainWindow(config:Mp.Config){

        const mainWindow = new BrowserWindow({
            width: config.bounds.width,
            height: config.bounds.height,
            x:config.bounds.x,
            y:config.bounds.y,
            autoHideMenuBar: true,
            show: false,
            icon: path.join(__dirname, "..", "static", "img", "icon.ico"),
            frame: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: PLAYER_WINDOW_PRELOAD_WEBPACK_ENTRY,
            },
        });

        mainWindow.loadURL(PLAYER_WINDOW_WEBPACK_ENTRY);

        return mainWindow

    }

    createPlaylistWindow(config:Mp.Config){

        const playlist = new BrowserWindow({
            backgroundColor: "#272626",
            width: config.playlistBounds.width,
            height: config.playlistBounds.height,
            x:config.playlistBounds.x,
            y:config.playlistBounds.y,
            autoHideMenuBar: true,
            show: false,
            frame:false,
            minimizable: false,
            maximizable: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: PLAYLIST_WINDOW_PRELOAD_WEBPACK_ENTRY,
            },
        })

        playlist.loadURL(PLAYLIST_WINDOW_WEBPACK_ENTRY);

        return playlist;
    }

    createConvertWindow(){

        const convertDialog = new BrowserWindow({
            backgroundColor: "#272626",
            width:640,
            height:700,
            resizable: true,
            autoHideMenuBar: true,
            show: false,
            frame:false,
            modal:true,
            minimizable: false,
            maximizable: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: CONVERT_WINDOW_PRELOAD_WEBPACK_ENTRY
            },
        })

        convertDialog.loadURL(CONVERT_WINDOW_WEBPACK_ENTRY);

        return convertDialog;
    }

    createMainContextMenu(config:Mp.Config, onclick: (menu:Mp.MainContextMenuType, args?:any) => void){
        const mainContextTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                label: "Playback Rate",
                submenu: this.playbackRateMenu(onclick)
            },
            {
                label: "Seek Speed",
                submenu: this.seekSpeedMenu(onclick)
            },
            { type: 'separator' },
            {
                label: "Convert",
                click: () => onclick("Convert")
            },
            { type: 'separator' },
            {
                label: "Open Playlist",
                click: () => onclick("OpenPlaylist")
            },
            {
                label: "Fit To Window Size",
                type: "checkbox",
                checked: config.video.fitToWindow,
                click: () => onclick("FitToWindow"),
            },
        ]

        return Menu.buildFromTemplate(mainContextTemplate)
    }

    private playbackRateMenu(onclick: (menu:Mp.MainContextMenuType, args?:any) => void){

        const type = "PlaybackRate"
        const contextTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                id: "playbackrate0",
                label:"0.25",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 0.25))
            },
            {
                id: "playbackrate1",
                label:"0.5",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 0.5))
            },
            {
                id: "playbackrate2",
                label:"0.75",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 0.75))
            },
            {
                id: "playbackrate3",
                label:"Default",
                type:"checkbox",
                checked:true,
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 1))
            },
            {
                id: "playbackrate4",
                label:"1.25",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 1.25))
            },
            {
                id: "playbackrate5",
                label:"1.5",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 1.5))
            },
            {
                id: "playbackrate6",
                label:"1.75",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 1.75))
            },
            {
                id: "playbackrate7",
                label:"2",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 2))
            },
        ]

        return Menu.buildFromTemplate(contextTemplate);
    }

    private seekSpeedMenu(onclick: (menu:Mp.MainContextMenuType, args?:any) => void){

        const type = "SeekSpeed"
        const contextTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                id: "seekspeed0",
                label:"0.03",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 0.03))
            },
            {
                id: "seekspeed1",
                label:"0.05",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 0.05))
            },
            {
                id: "seekspeed2",
                label:"0.1",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 0.1))
            },
            {
                id: "seekspeed3",
                label:"0.5",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 0.5))
            },
            {
                id: "seekspeed4",
                label:"1",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 1))
            },
            {
                id: "seekspeed5",
                label:"5",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 5))
            },
            {
                id: "seekspeed6",
                label:"10",
                type:"checkbox",
                checked:true,
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 10))
            },
            {
                id: "seekspeed7",
                label:"20",
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(type, 20))
            },
        ]

        return Menu.buildFromTemplate(contextTemplate);
    }

    createPlaylistContextMenu(config:Mp.Config, onclick: (menu:Mp.PlaylistContextMenuType) => void){

        const playlistContextTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                label: "Remove",
                click: () => onclick("Remove")
            },
            {
                label: "Trash",
                click: () => onclick("Trash")
            },
            { type: "separator" },
            {
                label: "Copy File Name",
                click: () => onclick("CopyFileName")
            },
            {
                label: "Reveal in File Explorer",
                click: () => onclick("Reveal")
            },
            { type: "separator" },
            {
                label: "Sort by",
                submenu: this.createPlaylistSortContextMenu(config, onclick)
            },
            { type: "separator" },
            {
                label: "Remove all",
                click: () => onclick("RemoveAll")
            },
        ]

        return Menu.buildFromTemplate(playlistContextTemplate);
    }

    private createPlaylistSortContextMenu(config:Mp.Config, onclick: (menu:Mp.PlaylistContextMenuType) => void){

        const playlistSortMenuTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                id: "NameAsc",
                label: "Name(Asc)",
                type: "checkbox",
                checked: config.sortType === "NameAsc",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick("NameAsc"))
            },
            {
                id: "NameDesc",
                label: "Name(Desc)",
                type: "checkbox",
                checked: config.sortType === "NameDesc",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick("NameDesc"))
            },
            {
                id: "DateAsc",
                label: "Date(Asc)",
                type: "checkbox",
                checked: config.sortType === "DateAsc",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick("DateAsc"))
            },
            {
                id: "DateDesc",
                label: "Date(Desc)",
                type: "checkbox",
                checked: config.sortType === "DateDesc",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick("DateDesc"))
            },
        ]

        return Menu.buildFromTemplate(playlistSortMenuTemplate);
    }

    createThumButtons(onclick: (button:Mp.ThumbButtonType) => void){

        const staticDir = path.join(__dirname, "..", "static");

        const playThumbButton:Electron.ThumbarButton = {
            tooltip: "Play",
            icon: nativeImage.createFromPath(path.join(staticDir, "img", "play.png")),
            click: () => onclick("Play"),
        }
        const pauseThumbButton:Electron.ThumbarButton = {
            tooltip: "Pause",
            icon: nativeImage.createFromPath(path.join(staticDir, "img", "pause.png")),
            click: () => onclick("Pause"),
        }
        const prevThumbButton:Electron.ThumbarButton = {
            tooltip: "Previous",
            icon: nativeImage.createFromPath(path.join(staticDir, "img", "backward.png")),
            click: () => onclick("Previous")
        }
        const nextThumbButton:Electron.ThumbarButton = {
            tooltip: "Next",
            icon: nativeImage.createFromPath(path.join(staticDir, "img", "forward.png")),
            click: () => onclick("Next")
        }

        const thumbButtonsOptionsPaused:Electron.ThumbarButton[] = [
            prevThumbButton,
            playThumbButton,
            nextThumbButton
        ]

        const thumbButtonsOptionsPlayed:Electron.ThumbarButton[] = [
            prevThumbButton,
            pauseThumbButton,
            nextThumbButton
        ]

        return [
            thumbButtonsOptionsPaused,
            thumbButtonsOptionsPlayed
        ]
    }

    private toggleMenuItemCheckbox(menuItem:Electron.MenuItem, onclick:() => void){

        menuItem.menu.items.forEach((item:Electron.MenuItem) => {
            if(item.id === menuItem.id){
                item.checked = true;
            }else{
                item.checked = false;
            }
        })

        onclick()
    }
}