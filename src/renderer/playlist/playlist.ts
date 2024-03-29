import { DomElement } from "../dom"
import { handleShortcut } from "../shortcut";

const List_Item_Padding = 10;

const Dom = {
    playlist: new DomElement("playlist"),
    playlistTitleBar:new DomElement("playlistTitleBar"),
    playlistFooter:new DomElement("playlistFooter"),
    fileList:new DomElement("fileList"),
    fileListContainer:new DomElement("fileListContainer"),
    renameInput:new DomElement<HTMLInputElement>("rename"),
    sortBtn: new DomElement("sort"),
}

const selection:Mp.PlaylistItemSelection ={
    selectedId:"",
    selectedIds:[]
}

const dragState:Mp.PlaylistDragState = {
    dragging: false,
    startElement:undefined,
    targetElement:undefined,
    startIndex: -1,
    working:false,
}

const RenameState = {
    renaming:false,
    data:{
        fileId:"",
        oldName:"",
        newName:""
    }

}
const undoStack:Mp.RenameData[] = []
const redoStack:Mp.RenameData[] = []

let currentElement:HTMLElement | undefined;
let selectedElement:HTMLElement | undefined;
let fileListContainerRect:DOMRect;

const onContextMenu = (e:MouseEvent) => {
    e.preventDefault()
    window.api.send("open-playlist-context", {})
}

const onKeydown = (e:KeyboardEvent) => {

    if(RenameState.renaming) return;

    if(e.key === "Enter"){
        return window.api.send("toggle-play", {})
    }

    if(e.ctrlKey && e.key === "a"){
        return selectAll();
    }

    if(e.ctrlKey && e.key === "z"){
        return undoRename();
    }

    if(e.ctrlKey && e.key === "y"){
        return redoRename();
    }

    if(e.key === "ArrowUp" || e.key === "ArrowDown"){
        e.preventDefault();
        return moveSelection(e);
    }

    if(e.key === "Home" || e.key === "End"){
        return moveSelectionUpto(e);
    }

    return handleShortcut("Playlist", e);
}

const onRenameInputKeyDown = (e:KeyboardEvent) => {
    if(RenameState.renaming && e.key === "Enter"){
        e.stopPropagation();
        e.preventDefault();
        endEditFileName();
    }
}

const onClick = (e:MouseEvent) => {
    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.id === "shuffleBtn"){
        toggleShuffle();
    }

    if(e.target.id === "sort"){
        window.api.send("open-sort-context", {x:e.clientX, y:e.clientY})
    }

}

const onMouseDown = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.classList.contains("playlist-item")){

        if(e.button === 2 && selection.selectedIds.length > 1){
            if(selection.selectedIds.includes(e.target.id)){
                return;
            }
        }

        return toggleSelect(e)

    }

    if(!e.target.classList.contains("group")){
        clearSelection();
    }

}

const onDragStart = (e:DragEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    e.stopPropagation();
    dragState.dragging = true;
    dragState.startElement = e.target;
    dragState.startIndex = getChildIndex(e.target)

}

const onDragEnter = (e:DragEvent) => {
    if(dragState.dragging){
        toggleHighlightDropTarget(e);
    }
}

const onDragEnd = (e:DragEvent) => {
    if(dragState.dragging){
        endDragPlaylistItem(e)
    }
}

const onResize = () => {
    fileListContainerRect = Dom.fileListContainer.element.getBoundingClientRect()
}

const onFileDrop = (e:DragEvent) => {

    if(dragState.dragging) return;

    e.preventDefault();
    e.stopPropagation();

    const items = e.dataTransfer ? e.dataTransfer.items : []

    const dropItems = Array.from(items).filter(item => {
        return item.kind === "file" && (item.type.includes("video") || item.type.includes("audio"));
    })

    if(dropItems.length){
        const files = dropItems.map(item => item.getAsFile()?.path ?? "")
        window.api.send("drop", {files, renderer:"Playlist"})
    }
}

const removeFromPlaylist = (data:Mp.RemovePlaylistItemResult) => {

    clearSelection();

    const targetNodes = data.removedFileIds.map(id => new DomElement(id).element)
    const dirSet = new Set<string>();
    targetNodes.forEach(node => {
        if(currentElement && node.id === currentElement.id){
            currentElement = undefined;
        }
        dirSet.add(node.getAttribute("data-dir") ?? "")
        Dom.fileList.element.removeChild(node)
    })

    dirSet.forEach(dir => {
        if(!Dom.fileList.element.querySelectorAll(`div[data-dir="${dir}"]`).length){
            new DomElement(dir).element.remove();
        }
    })
}

const toggleHighlightDropTarget = (e:DragEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(!dragState.dragging) return;

    dragState.targetElement?.classList.remove("draghover");

    if(dragState.startElement?.getAttribute("data-dir") !== e.target.getAttribute("data-dir")){
        dragState.targetElement = undefined;
        return;
    }

    dragState.targetElement = e.target;

    if(dragState.targetElement.id === dragState.startElement?.id) return;

    dragState.targetElement.classList.add("draghover")

}

const endDragPlaylistItem = (e:DragEvent) => {

    if(dragState.targetElement){

        dropPlaylistItem();
        toggleHighlightDropTarget(e)

        const args = {
            start:dragState.startIndex,
            end:getChildIndex(dragState.startElement),
            currentIndex:getChildIndex(currentElement)
        }

        window.api.send("change-playlist-order", args);
        window.api.send("playlist-item-selection-change", {selection})

    }

    dragState.dragging = false;
    dragState.startElement = undefined;
    dragState.startIndex = -1;
    dragState.targetElement = undefined;
}

const dropPlaylistItem = () => {

    if(!dragState.dragging || !dragState.startElement || !dragState.targetElement) return;

    const currentIndex = selection.selectedIds.indexOf(dragState.startElement.id);
    const dropTargetIndex = getChildIndex(dragState.targetElement)
    if(dropTargetIndex > dragState.startIndex){
        dragState.targetElement.parentNode?.insertBefore(dragState.startElement, dragState.targetElement.nextElementSibling);
    }else{
        dragState.targetElement.parentNode?.insertBefore(dragState.startElement, dragState.targetElement);
    }
    selection.selectedIds[currentIndex] = dragState.startElement.id;

    scrollToElement(dragState.startElement)

}

const clearPlaylist = () => {
    selection.selectedId = "";
    selection.selectedIds = []
    currentElement = undefined;
    selectedElement = undefined;
    Dom.fileList.element.innerHTML = "";
}

const clearSelection = () => {
    selection.selectedIds.forEach(id => new DomElement(id).element.classList.remove("selected"))
    selection.selectedIds.length = 0;
    window.api.send("playlist-item-selection-change", {selection})
}

const toggleSelect = (e:MouseEvent) => {

    if(e.ctrlKey){
        selectByCtrl(e.target as HTMLElement)
        return;
    }

    if(e.shiftKey){
        selectByShift(e.target as HTMLElement);
        return
    }

    selectByClick(e.target as HTMLElement);

}

const select = (target:HTMLElement | string) => {

    clearSelection();

    const targetElement = typeof target === "string" ? new DomElement(target).element : target;

    selectedElement = targetElement;

    selection.selectedIds.push(selectedElement.id)
    selection.selectedId = selectedElement.id;

    selectedElement.classList.add("selected")

    scrollToElement(selectedElement)

    window.api.send("playlist-item-selection-change", {selection})
}

const selectByClick = (target:HTMLElement) => {
    select(target);
}

const selectByShift = (target:HTMLElement) => {

    clearSelection();

    const range = [];

    if(selectedElement){
        range.push(getChildNodeIndex(selectedElement));
    }else{
        range.push(0);
    }

    range.push(getChildNodeIndex(target));

    range.sort((a,b) => a - b);

    for(let i = range[0]; i <= range[1]; i++){
        const node = Dom.fileList.element.children[i];
        if(!node.classList.contains("group")){
            selection.selectedIds.push(node.id);
            node.classList.add("selected")
        }
    }

    window.api.send("playlist-item-selection-change", {selection})
}

const selectByCtrl = (target:HTMLElement) => {

    if(!selectedElement){
        selectByClick(target);
        return;
    }

    if(target.classList.contains("group")) return;

    selection.selectedIds.push(target.id)

    target.classList.add("selected")

    window.api.send("playlist-item-selection-change", {selection})
}

const selectAll = () => {

    clearSelection();

    Array.from(Dom.fileList.element.children).forEach((node,_index) => {
        if(!node.classList.contains("group")){
            node.classList.add("selected")
            selection.selectedIds.push(node.id);
        }
    })

    window.api.send("playlist-item-selection-change", {selection})

}

const findNext = (key:string, element:Element):HTMLElement | null => {

    const nextElement = key === "ArrowDown" ? element.nextElementSibling : element.previousElementSibling

    if(!nextElement) return null;

    if(nextElement.classList.contains("group")){
        return findNext(key, nextElement);
    }

    return nextElement as HTMLElement;

}

const moveSelection = (e:KeyboardEvent) => {

    if(!Dom.fileList.element.children.length) return;

    const key = e.key;

    if(e.shiftKey){
        return moveSelectionByShit(key);
    }

    const currentId = selection.selectedId ? selection.selectedId : Dom.fileList.element.children[0].id

    const nextElement = findNext(key, new DomElement(currentId).element)

    if(!nextElement) return;

    clearSelection();
    select(nextElement.id)
}

const moveSelectionByShit = (key:string) => {

    if(!selection.selectedIds.length){
        select(Dom.fileList.element.children[0].id);
    }

    const downward = selection.selectedId == selection.selectedIds[0];
    const currentId = downward ? selection.selectedIds[selection.selectedIds.length -1] : selection.selectedIds[0]

    const nextElement = findNext(key, new DomElement(currentId).element)

    if(!nextElement) return;

    return selectByShift(nextElement);
}

const moveSelectionUpto = (e:KeyboardEvent) => {

    if(!Dom.fileList.element.children.length) return;

    if(!e.shiftKey) return;

    e.preventDefault();

    const uptoElement = e.key === "Home" ? Dom.fileList.element.children[0] : Dom.fileList.element.children[Dom.fileList.element.children.length - 1]

    selectByShift(uptoElement as HTMLElement);
    scrollToElement(uptoElement as HTMLElement)
}

const onFileListItemClicked = (e:MouseEvent) => {
    const index = getChildIndex(e.target as HTMLElement);
    window.api.send("load-file", {index, isAbsolute:true});
}

const getChildIndex = (node:HTMLElement | undefined) => {
    if(!node) return -1;

    const childNodes = Array.from(Dom.fileList.element.children).filter(childNode => !childNode.classList.contains("group"))

    return Array.prototype.indexOf.call(childNodes, node);
}

const getChildNodeIndex = (node:HTMLElement | undefined) => {

    if(!node) return -1;

    return Array.prototype.indexOf.call(Dom.fileList.element.children, node);
}

const scrollToElement = (element:HTMLElement | undefined) => {

    if(!element) return;

    const rect = element.getBoundingClientRect();
    if(rect.top <= fileListContainerRect.top){
        element.scrollIntoView(true)
    }

    if(rect.bottom > fileListContainerRect.height + fileListContainerRect.top + 5){
        element.scrollIntoView(false)
    }

}

const changeCurrent = (data:Mp.FileLoadEvent) => {

    if(currentElement){
        currentElement.classList.remove("current");
    }

    if(data.currentFile.id){
        currentElement = new DomElement(data.currentFile.id).element;
        currentElement.classList.add("current");
        select(data.currentFile.id)
    }
}

const requestRename = (id:string, name:string) => {
    preventRenameBlur(true)
    window.api.send("rename-file", {id, name})
}

const onRename = (data:Mp.RenameResult) => {

    if(!selectedElement) return;

    if(selectedElement.id !== data.file.id){
        select(data.file.id);
    }

    if(data.error && RenameState.renaming){
        undoStack.pop();
        startEditFileName();
        return;
    }

    const fileName = data.file.name

    selectedElement.textContent = fileName
    selectedElement.title = fileName

    hideRenameField();

}

const undoRename = () => {

    const stack = undoStack.pop();

    if(!stack) return;

    redoStack.push(stack);

    select(stack.fileId)

    requestRename(stack.fileId, stack.oldName)

}

const redoRename = () => {

    const stack = redoStack.pop();

    if(!stack) return;

    undoStack.push(stack);

    select(stack.fileId)

    requestRename(stack.fileId, stack.newName)

}

const startEditFileName = () => {

    if(!selectedElement) return;

    const fileName = selectedElement.textContent ?? "";

    RenameState.renaming = true;
    RenameState.data.fileId = selectedElement.id;
    RenameState.data.oldName = fileName;

    const rect = selectedElement.getBoundingClientRect();
    Dom.renameInput.element.style.top = rect.top + "px"
    Dom.renameInput.element.style.left = rect.left + "px"
    Dom.renameInput.element.style.width = selectedElement.offsetWidth - List_Item_Padding + "px";
    Dom.renameInput.element.style.height = selectedElement.offsetHeight - List_Item_Padding + "px";
    Dom.renameInput.element.value = fileName;
    Dom.renameInput.element.style.display = "block"
    selectFileName(fileName);

    preventRenameBlur(false);
}

const selectFileName = (fileName:string) => {
    Dom.renameInput.element.focus();
    Dom.renameInput.element.setSelectionRange(0, fileName.lastIndexOf("."));
}

const preventRenameBlur = (disable:boolean) => {

    if(disable){
        Dom.renameInput.element.removeEventListener("blur", endEditFileName);
    }else{
        Dom.renameInput.element.addEventListener("blur", endEditFileName);
    }

}

const endEditFileName = () => {

    if(RenameState.data.oldName === Dom.renameInput.element.value){
        hideRenameField();
    }else{
        RenameState.data.newName = Dom.renameInput.element.value;
        undoStack.push({...RenameState.data})
        requestRename(RenameState.data.fileId, RenameState.data.newName);
    }

}

const hideRenameField = () => {
    RenameState.renaming = false;
    Dom.renameInput.element.style.display = "none"
}

const onReset = () => {
    currentElement = undefined;
    selectedElement = undefined;
    clearPlaylist();
}

const toggleShuffle = () => {

    if(Dom.playlistFooter.element.classList.contains("shuffle")){
        Dom.playlistFooter.element.classList.remove("shuffle")
    }else{
        Dom.playlistFooter.element.classList.add("shuffle")
    }

    window.api.send("toggle-shuffle", {})
}

const createListItem = (file:Mp.MediaFile) => {

    const item = document.createElement("div");
    item.title = file.name
    item.id = file.id;
    item.textContent = file.name
    item.draggable = true;
    item.classList.add("playlist-item")
    item.addEventListener("dblclick", onFileListItemClicked);
    item.addEventListener("dragstart", onDragStart)
    item.addEventListener("dragenter", onDragEnter)
    item.addEventListener("dragend", onDragEnd)
    return item
}

const createSeparator = (directory:string) => {

    const group = document.createElement("div");
    group.classList.add("group", "separator");
    group.title = directory;
    group.id = encodeURIComponent(directory);

    const left = document.createElement("div");
    left.classList.add("left", "separator");
    const mid = document.createElement("div");
    mid.classList.add("mid", "separator");
    mid.textContent = directory;
    const right = document.createElement("div");
    right.classList.add("right", "separator");

    group.append(left, mid, right)

    return group;
}

const addToPlaylist = (data:Mp.PlaylistChangeEvent) => {

    const currentId = currentElement?.id;

    if(data.clearPlaylist){
        clearPlaylist();
    }

    if(!data.files.length) return;

    const fragment = document.createDocumentFragment();

    let key = ""
    let group:HTMLDivElement;

    data.files.forEach(file => {

        const item = createListItem(file);

        if(file.dir != key){
            key = file.dir;
            group = createSeparator(key)
            fragment.append(group);
        }

        item.setAttribute("data-dir", group.id)

        if(file.id === currentId){

            item.classList.add("current")
            currentElement = item;
        }

        fragment.appendChild(item);

    });

    Dom.fileList.element.appendChild(fragment)

    if(currentElement){
        select(currentElement);
    }

}

const applySortType = (config:Mp.SortType) => {

    Dom.sortBtn.element.setAttribute("data-sort", config.order)

    Dom.fileList.element.classList.remove("group-by")

    if(config.groupBy){
        Dom.fileList.element.classList.add("group-by")
    }

}


const prepare = (e:Mp.ReadyEvent) => {
    applySortType(e.config.sort)
}

window.api.receive("ready", prepare);
window.api.receive("sort-type-change", applySortType)
window.api.receive("playlist-change", addToPlaylist)
window.api.receive("after-file-load", changeCurrent)
window.api.receive("after-remove-playlist", removeFromPlaylist)
window.api.receive("after-rename", onRename);
window.api.receive("start-rename", startEditFileName)
window.api.receive("restart", onReset)
window.api.receive("clear-playlist", clearPlaylist)

window.addEventListener("load", () => {

    Dom.fileListContainer.element.addEventListener("mousedown", onMouseDown)
    fileListContainerRect = Dom.fileListContainer.element.getBoundingClientRect();
    Dom.renameInput.element.addEventListener("blur", endEditFileName)
    Dom.renameInput.element.addEventListener("keydown", onRenameInputKeyDown)

    new DomElement("closePlaylistBtn").element.addEventListener("click", () => window.api.send("close-playlist", {}))

    window.addEventListener("resize", onResize)

})

window.addEventListener("contextmenu", onContextMenu)

window.addEventListener("keydown",onKeydown)
document.addEventListener("click", onClick)
document.addEventListener("dragover", e => e.preventDefault())
document.addEventListener("drop", onFileDrop)

export {}