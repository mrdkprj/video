import { Menu, nativeImage } from "electron"
import path from "path"
import { MainContextMenuTypes, PlaylistContextMenuTypes, ThumbButtonTypes } from "./enum";

export default class Helper{

    private playlistSortMenu:Electron.Menu;

    createMainContextMenu(onclick: (menu:MainContextMenuTypes) => void){
        const mainContextTemplate:Electron.MenuItemConstructorOptions[] = [
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

    private toggleSortMenu(menuItem:Electron.MenuItem){
        this.playlistSortMenu.items.forEach((item:Electron.MenuItem) => {
            if(item.id === menuItem.id){
                item.checked = true;
            }else{
                item.checked = false;
            }
        })
    }

    private createPlaylistSortContextMenu(onclick: (menu:PlaylistContextMenuTypes) => void){

        const playlistSortMenuTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                id: PlaylistContextMenuTypes.NameAsc,
                label: "Name asc",
                type: "checkbox",
                click: (menuItem) => {
                    this.toggleSortMenu(menuItem);
                    onclick(PlaylistContextMenuTypes.NameAsc)
                }
            },
            {
                id: PlaylistContextMenuTypes.NameDesc,
                label: "Name desc",
                type: "checkbox",
                click: (menuItem) => {
                    this.toggleSortMenu(menuItem);
                    onclick(PlaylistContextMenuTypes.NameDesc)
                }
            },
            {
                id: PlaylistContextMenuTypes.DateAsc,
                label: "Date asc",
                type: "checkbox",
                click: (menuItem) => {
                    this.toggleSortMenu(menuItem);
                    onclick(PlaylistContextMenuTypes.DateAsc)
                }
            },
            {
                id: PlaylistContextMenuTypes.DateDesc,
                label: "Date desc",
                type: "checkbox",
                click: (menuItem) => {
                    this.toggleSortMenu(menuItem);
                    onclick(PlaylistContextMenuTypes.DateDesc)
                }
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
}