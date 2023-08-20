import { DomElement } from "../dom"

const List_Item_Padding = 10;

const Dom = {
    playlist: new DomElement("playlist"),
    playlistTitleBar:new DomElement("playlistTitleBar"),
    playlistFooter:new DomElement("playlistFooter"),
    fileList:new DomElement("fileList"),
    fileListContainer:new DomElement("fileListContainer"),
    renameInput:new DomElement<HTMLInputElement>("rename"),
}

const selectedFileIds:string[] = [];

const dragState:Mp.PlaylistDragState = {
    dragging: false,
    startElement:undefined,
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
    window.api.send("open-playlist-context", {fileIds:selectedFileIds})
}

const onKeydown = (e:KeyboardEvent) => {

    if(e.ctrlKey && e.key === "r") e.preventDefault();

    if(e.key === "Enter"){

        if(!RenameState.renaming){
            window.api.send("toggle-play", {})
        }
    }

    if(selectedFileIds.length > 0){

        if(e.key === "Delete"){
            window.api.send("remove-playlist-item", {fileIds:selectedFileIds})
        }
    }

    if(e.ctrlKey && e.key === "a"){
        selectAll();
    }

    if(e.key == "F2"){
        startEditFileName()
    }

    if(e.ctrlKey && e.key === "z"){
        undoRename();
    }

    if(e.ctrlKey && e.key === "y"){
        redoRename();
    }

}

const onRenameInputKeyDown = (e:KeyboardEvent) => {
    if(RenameState.renaming && e.key === "Enter"){
        endEditFileName();
    }
}

const onClick = (e:MouseEvent) => {
    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.id === "shuffleBtn"){
        toggleShuffle();
    }
}

const onMouseDown = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.classList.contains("playlist-item")){

        e.stopPropagation();

        if(e.button === 2 && selectedFileIds.length > 1){
            if(selectedFileIds.includes(e.target.id)){
                return;
            }
        }

        toggleSelect(e)

        if(selectedFileIds.length > 1) return;

        dragState.dragging = true;
        dragState.startElement = e.target;
        dragState.startIndex = getChildIndex(e.target)

    }else{
        clearSelection();
    }
}

const onMouseUp = (_e:MouseEvent) => {
    if(dragState.dragging && dragState.startElement){
        const args = {start:dragState.startIndex, end:getChildIndex(dragState.startElement), currentIndex:getChildIndex(currentElement)}
        window.api.send("change-playlist-order", args);
    }
    dragState.dragging = false;
}

const onMouseEnter = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    movePlaylistItem(e);
}

const onResize = () => {
    fileListContainerRect = Dom.fileListContainer.element.getBoundingClientRect()
}

const movePlaylistItem = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(!dragState.dragging || !dragState.startElement) return;

    if(dragState.working){
        e.preventDefault();
        return
    }

    dragState.working = true;

    const currentIndex = selectedFileIds.indexOf(dragState.startElement.id);
    const dropRect = e.target.getBoundingClientRect();
    const dropPosition = e.clientY - dropRect.top;
    if(dropPosition <= dropRect.height){
        e.target.parentNode?.insertBefore(dragState.startElement, e.target);
    }else{
        e.target.parentNode?.insertBefore(e.target, dragState.startElement);
    }
    selectedFileIds[currentIndex] = dragState.startElement.id;

    dragState.working = false;

}

const clearPlaylist = () => {
    Dom.fileList.element.innerHTML = "";
}

const onFileDrop = (e:DragEvent) => {

    e.preventDefault();
    e.stopPropagation();

    dragState.dragging = false;

    const items = e.dataTransfer ? e.dataTransfer.items : []

    const dropItems = Array.from(items).filter(item => {
        return item.kind === "file" && (item.type.includes("video") || item.type.includes("audio"));
    })

    if(dropItems.length){
        const files = dropItems.map(item => item.getAsFile()?.path ?? "")
        window.api.send("drop", {files, renderer:"Playlist"})
    }
}

const createListItem = (file:Mp.MediaFile) => {

    const item = document.createElement("li");
    item.title = file.name
    item.id = file.id;
    item.textContent = file.name
    item.classList.add("playlist-item")
    item.addEventListener("dblclick", onFileListItemClicked);
    item.addEventListener("mouseenter", onMouseEnter)
    item.addEventListener("mouseleave", movePlaylistItem)

    return item
}

const addToPlaylist = (data:Mp.PlaylistChangeEvent) => {

    if(data.clearPlaylist){
        clearPlaylist();
    }

    if(!data.files.length) return;

    const fragment = document.createDocumentFragment();

    data.files.forEach(file => {

        fragment.appendChild(createListItem(file));

    });

    Dom.fileList.element.appendChild(fragment)

}

const removeFromPlaylist = (data:Mp.RemovePlaylistResult) => {
    clearSelection();
    const targetNodes = data.removedFileIds.map(id => new DomElement(id).fill())
    targetNodes.forEach(node => {
        if(currentElement && node.id === currentElement.id){
            currentElement = undefined;
        }
        Dom.fileList.element.removeChild(node)
    })
}

const clearSelection = () => {
    selectedFileIds.forEach(id => new DomElement(id).fill().classList.remove("selected"))
    selectedFileIds.length = 0;
}

const toggleSelect = (e:MouseEvent) => {

    if(e.ctrlKey){
        selectByCtrl(e)
        return;
    }

    if(e.shiftKey){
        selectByShift(e);
        return
    }

    selectByClick(e);

}

const select = (target:HTMLElement | string) => {

    clearSelection();

    const targetElement = typeof target === "string" ? new DomElement(target).fill() : target;

    selectedElement = targetElement;

    selectedFileIds.push(selectedElement.id)

    selectedElement.classList.add("selected")

}

const selectByClick = (e:MouseEvent) => {
    select(e.target as HTMLElement);
}

const selectByShift = (e:MouseEvent) => {

    clearSelection();

    const range = [];

    if(selectedElement){
        range.push(getChildIndex(selectedElement));
    }else{
        range.push(0);
    }

    range.push(getChildIndex(e.target as HTMLElement));

    range.sort((a,b) => a - b);

    for(let i = range[0]; i <= range[1]; i++){
        selectedFileIds.push(Dom.fileList.element.children[i].id);
        Dom.fileList.element.children[i].classList.add("selected")
    }

}

const selectByCtrl = (e:MouseEvent) => {

    if(!selectedElement){
        selectByClick(e);
        return;
    }

    const target = (e.target as HTMLElement);
    selectedFileIds.push(target.id)

    target.classList.add("selected")
}

const selectAll = () => {

    clearSelection();

    Array.from(Dom.fileList.element.children).forEach((node,_index) => {
        node.classList.add("selected")
        selectedFileIds.push(node.id);
    })

}

const onFileListItemClicked = (e:MouseEvent) => {
    const index = getChildIndex(e.target as HTMLElement);
    window.api.send("load-file", {index, isAbsolute:true});
}

function getChildIndex(node:HTMLElement | undefined) {
    if(!node) return -1;

    return Array.prototype.indexOf.call(Dom.fileList.element.childNodes, node);
}

const changeCurrent = (data:Mp.FileLoadEvent) => {

    if(currentElement){
        currentElement.classList.remove("current");
    }

    if(data.currentFile.id){
        currentElement = new DomElement(data.currentFile.id).fill();
        currentElement.classList.add("current");

        const rect = currentElement.getBoundingClientRect();
        if(rect.top < 0){
            currentElement.scrollIntoView(true)
        }

        if(rect.bottom > fileListContainerRect.height){
            currentElement.scrollIntoView(false)
        }
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
    selectedFileIds.length = 0;
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

const onAfterSort = (data:Mp.SortResult) => {

    const lists = Array.from(Dom.fileList.element.children)

    if(!lists.length) return;

    lists.sort((a,b) => data.fileIds.indexOf(a.id) - data.fileIds.indexOf(b.id))

    Dom.fileList.element.innerHTML = "";

    lists.forEach(li => Dom.fileList.element.appendChild(li))

}

window.api.receive("playlist-change", addToPlaylist)
window.api.receive("after-file-load", changeCurrent)
window.api.receive("after-remove-playlist", removeFromPlaylist)
window.api.receive("after-sort", onAfterSort)
window.api.receive("after-rename", onRename);
window.api.receive("restart", onReset)

window.addEventListener("load", () => {

    Dom.playlist.fill()
    Dom.playlistTitleBar.fill()
    Dom.playlistFooter.fill()
    Dom.fileList.fill()
    Dom.fileListContainer.fill()
    fileListContainerRect = Dom.fileListContainer.element.getBoundingClientRect();
    Dom.renameInput.fill()
    Dom.renameInput.element.addEventListener("blur", endEditFileName)
    Dom.renameInput.element.addEventListener("keydown", onRenameInputKeyDown)

    new DomElement("closePlaylistBtn").fill().addEventListener("click", () => window.api.send("close-playlist", {}))

    window.addEventListener("resize", onResize)

})

window.addEventListener("contextmenu", onContextMenu)

window.addEventListener("keydown",onKeydown)
document.addEventListener("click", onClick)
document.addEventListener("mousedown", onMouseDown);
document.addEventListener("dragover", e => e.preventDefault())
document.addEventListener("mouseup", onMouseUp);
document.addEventListener("drop", onFileDrop)

export {}