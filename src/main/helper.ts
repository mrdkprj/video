import { BrowserWindow, Menu, nativeImage } from "electron"
import path from "path"
import { MainContextMenuTypes, PlaylistContextMenuTypes, ThumbButtonTypes } from "./enum";

export default class Helper{

    private playlistSortMenu:Electron.Menu;

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
                preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
            },
        });

        mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

        return mainWindow

    }

    createPlaylistWindow(parent:BrowserWindow, config:Mp.Config){

        const playlist = new BrowserWindow({
            parent: parent,
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

    createTooltipWindow(parent:BrowserWindow){

        const tooltip = new BrowserWindow({
            parent: parent,
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

        return tooltip;
    }

    createConvertWindow(parent:BrowserWindow){

        const convertDialog = new BrowserWindow({
            parent: parent,
            backgroundColor: "#272626",
            width:640,
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

    createMainContextMenu(onclick: (menu:MainContextMenuTypes, args?:any) => void){
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
                click: () => onclick(MainContextMenuTypes.Convert)
            },
            { type: 'separator' },
            {
                label: "Open Playlist",
                click: () => onclick(MainContextMenuTypes.OpenPlaylist)
            },
            {
                label: "Fit To Window Size",
                type: "checkbox",
                checked: false,
                click: () => onclick(MainContextMenuTypes.FitToWindow),
            },
        ]

        return Menu.buildFromTemplate(mainContextTemplate)
    }

    private playbackRateMenu(onclick: (menu:MainContextMenuTypes, args?:any) => void){

        const type = MainContextMenuTypes.PlaybackRate
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

    private seekSpeedMenu(onclick: (menu:MainContextMenuTypes, args?:any) => void){

        const type = MainContextMenuTypes.SeekSpeed
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

    createPlaylistContextMenu(onclick: (menu:PlaylistContextMenuTypes) => void){

        this.playlistSortMenu = this.createPlaylistSortContextMenu(onclick);

        const playlistContextTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                label: "Remove",
                click: () => onclick(PlaylistContextMenuTypes.Remove)
            },
            {
                label: "Remove all",
                click: () => onclick(PlaylistContextMenuTypes.RemoveAll)
            },
            {
                label: "Trash",
                click: () => onclick(PlaylistContextMenuTypes.Trash)
            },
            { type: "separator" },
            {
                label: "Copy File Name",
                click: () => onclick(PlaylistContextMenuTypes.CopyFileName)
            },
            {
                label: "Reveal in File Explorer",
                click: () => onclick(PlaylistContextMenuTypes.Reveal)
            },
            { type: "separator" },
            {
                label: "Sort by",
                submenu: this.playlistSortMenu
            }
        ]

        return Menu.buildFromTemplate(playlistContextTemplate);
    }

    private createPlaylistSortContextMenu(onclick: (menu:PlaylistContextMenuTypes) => void){

        const playlistSortMenuTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                id: PlaylistContextMenuTypes.NameAsc,
                label: "Name asc",
                type: "checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(PlaylistContextMenuTypes.NameAsc))
            },
            {
                id: PlaylistContextMenuTypes.NameDesc,
                label: "Name desc",
                type: "checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(PlaylistContextMenuTypes.NameDesc))
            },
            {
                id: PlaylistContextMenuTypes.DateAsc,
                label: "Date asc",
                type: "checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(PlaylistContextMenuTypes.DateAsc))
            },
            {
                id: PlaylistContextMenuTypes.DateDesc,
                label: "Date desc",
                type: "checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(PlaylistContextMenuTypes.DateDesc))
            },
        ]

        return Menu.buildFromTemplate(playlistSortMenuTemplate);
    }

    createThumButtons(onclick: (button:ThumbButtonTypes) => void){

        const staticDir = path.join(__dirname, "..", "static");

        const playThumbButton:Electron.ThumbarButton = {
            tooltip: "Play",
            icon: nativeImage.createFromPath(path.join(staticDir, "img", "play.png")),
            click: () => onclick(ThumbButtonTypes.Play),
        }
        const pauseThumbButton:Electron.ThumbarButton = {
            tooltip: "Pause",
            icon: nativeImage.createFromPath(path.join(staticDir, "img", "pause.png")),
            click: () => onclick(ThumbButtonTypes.Pause),
        }
        const prevThumbButton:Electron.ThumbarButton = {
            tooltip: "Previous",
            icon: nativeImage.createFromPath(path.join(staticDir, "img", "backward.png")),
            click: () => onclick(ThumbButtonTypes.Previous)
        }
        const nextThumbButton:Electron.ThumbarButton = {
            tooltip: "Next",
            icon: nativeImage.createFromPath(path.join(staticDir, "img", "forward.png")),
            click: () => onclick(ThumbButtonTypes.Next)
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