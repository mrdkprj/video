const List_Item_Padding = 10;

const Dom = {
    playlist: null as HTMLElement,
    playlistTitleBar:null as HTMLElement,
    playlistFooter:null as HTMLElement,
    fileList:null as HTMLElement,
    fileListContainer:null as HTMLElement,
    renameInput:null as HTMLInputElement,
}

const selectedFileIds:string[] = [];

const dragState:Mp.PlaylistDragState = {
    dragging: false,
    startElement:null,
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

let currentElement:HTMLElement;
let selectedElement:HTMLElement;
let fileListContainerRect:DOMRect;

const onContextMenu = (e:MouseEvent) => {
    e.preventDefault()
    window.api.send("open-playlist-context", {fileIds:selectedFileIds})
}

const onKeydown = (e:KeyboardEvent) => {

    if(e.ctrlKey && e.key === "r") e.preventDefault();

    if(e.key === "Enter"){

        if(!RenameState.renaming){
            window.api.send("toggle-play", null)
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
    if(dragState.dragging){
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
    fileListContainerRect = Dom.fileListContainer.getBoundingClientRect()
}

const movePlaylistItem = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(!dragState.dragging) return;

    if(dragState.working){
        e.preventDefault();
        return
    }

    dragState.working = true;

    const currentIndex = selectedFileIds.indexOf(dragState.startElement.id);
    const dropRect = e.target.getBoundingClientRect();
    const dropPosition = e.clientY - dropRect.top;
    if(dropPosition <= dropRect.height){
        e.target.parentNode.insertBefore(dragState.startElement, e.target);
    }else{
        e.target.parentNode.insertBefore(e.target, dragState.startElement);
    }
    selectedFileIds[currentIndex] = dragState.startElement.id;

    dragState.working = false;

}

const clearPlaylist = () => {
    Dom.fileList.innerHTML = "";
}

const onFileDrop = (e:DragEvent) => {

    e.preventDefault();
    e.stopPropagation();

    dragState.dragging = false;

    const dropFiles = Array.from(e.dataTransfer.items).filter(item => {
        return item.kind === "file" && (item.type.includes("video") || item.type.includes("audio"));
    })

    if(dropFiles.length > 0){
        window.api.send("drop", {files:dropFiles.map(item => item.getAsFile().path), renderer:"Playlist"})
    }
}

const createListItem = (file:Mp.MediaFile) => {

    const item = document.createElement("li");
    item.title = file.name
    item.id = file.id;
    //item.setAttribute("data-uuid", file.uuid)
    item.textContent = file.name
    item.classList.add("playlist-item")
    item.addEventListener("dblclick", onFileListItemClicked);
    item.addEventListener("mouseenter", onMouseEnter)
    item.addEventListener("mouseleave", movePlaylistItem)

    return item
}

const addToPlaylist = (data:Mp.DropResult) => {

    if(!data.files.length) return;

    const fragment = document.createDocumentFragment();

    data.files.forEach(file => {

        fragment.appendChild(createListItem(file));

    });

    Dom.fileList.appendChild(fragment)

}

const removeFromPlaylist = (data:Mp.RemovePlaylistResult) => {
    clearSelection();
    const targetNodes = data.removedFileIds.map(id => document.getElementById(id))
    targetNodes.forEach(node => {
        if(currentElement && node.id === currentElement.id){
            currentElement = null;
        }
        Dom.fileList.removeChild(node)
    })
}

const clearSelection = () => {
    selectedFileIds.forEach(id => document.getElementById(id).classList.remove("selected"))
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

    const targetElement = typeof target === "string" ? document.getElementById(target) : target;

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
        selectedFileIds.push(Dom.fileList.children[i].id);
        Dom.fileList.children[i].classList.add("selected")
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

    Array.from(Dom.fileList.children).forEach((node,_index) => {
        node.classList.add("selected")
        selectedFileIds.push(node.id);
    })

}

const onFileListItemClicked = (e:MouseEvent) => {
    const index = getChildIndex(e.target as HTMLElement);
    window.api.send("load-file", {index, isAbsolute:true});
}

function getChildIndex(node:HTMLElement) {
    if(!node) return -1;

    return Array.prototype.indexOf.call(Dom.fileList.childNodes, node);
}

const changeCurrent = (data:Mp.FileLoadEvent) => {

    if(currentElement){
        currentElement.classList.remove("current");
    }

    if(data.currentFile.id){
        currentElement = document.getElementById(data.currentFile.id);
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
    if(!undoStack.length) return;

    const stack = undoStack.pop();
    redoStack.push(stack);

    select(stack.fileId)

    requestRename(stack.fileId, stack.oldName)

}

const redoRename = () => {
    if(!redoStack.length) return;

    const stack = redoStack.pop();
    undoStack.push(stack);

    select(stack.fileId)

    requestRename(stack.fileId, stack.newName)

}

const startEditFileName = () => {

    if(!selectedElement) return;

    const fileName = selectedElement.textContent;

    RenameState.renaming = true;
    RenameState.data.fileId = selectedElement.id;
    RenameState.data.oldName = fileName;

    const rect = selectedElement.getBoundingClientRect();
    Dom.renameInput.style.top = rect.top + "px"
    Dom.renameInput.style.left = rect.left + "px"
    Dom.renameInput.style.width = selectedElement.offsetWidth - List_Item_Padding + "px";
    Dom.renameInput.style.height = selectedElement.offsetHeight - List_Item_Padding + "px";
    Dom.renameInput.value = fileName;
    Dom.renameInput.style.display = "block"
    selectFileName(fileName);

    preventRenameBlur(false);
}

const selectFileName = (fileName:string) => {
    Dom.renameInput.focus();
    Dom.renameInput.setSelectionRange(0, fileName.lastIndexOf("."));
}

const preventRenameBlur = (disable:boolean) => {

    if(disable){
        Dom.renameInput.removeEventListener("blur", endEditFileName);
    }else{
        Dom.renameInput.addEventListener("blur", endEditFileName);
    }

}

const endEditFileName = () => {

    if(RenameState.data.oldName === Dom.renameInput.value){
        hideRenameField();
    }else{
        RenameState.data.newName = Dom.renameInput.value;
        undoStack.push({...RenameState.data})
        requestRename(RenameState.data.fileId, RenameState.data.newName);
    }

}

const hideRenameField = () => {
    RenameState.renaming = false;
    Dom.renameInput.style.display = "none"
}

const onReset = () => {
    currentElement = null;
    selectedElement = null;
    selectedFileIds.length = 0;
    clearPlaylist();
}

const toggleShuffle = () => {

    if(Dom.playlistFooter.classList.contains("shuffle")){
        Dom.playlistFooter.classList.remove("shuffle")
    }else{
        Dom.playlistFooter.classList.add("shuffle")
    }

    window.api.send("toggle-shuffle", null)
}

const onAfterSort = (data:Mp.SortResult) => {

    const lists = Array.from(Dom.fileList.children)

    if(!lists.length) return;

    lists.sort((a,b) => data.fileIds.indexOf(a.id) - data.fileIds.indexOf(b.id))

    Dom.fileList.innerHTML = "";

    lists.forEach(li => Dom.fileList.appendChild(li))

}

window.api.receive("clear-playlist", clearPlaylist)

window.api.receive("after-drop", addToPlaylist)

window.api.receive("after-file-load", changeCurrent)

window.api.receive("after-remove-playlist", removeFromPlaylist)

window.api.receive("after-sort", onAfterSort)

window.api.receive("after-rename", onRename);

window.api.receive("restart", onReset)

window.addEventListener("load", () => {

    Dom.playlist = document.getElementById("playlist")
    Dom.playlistTitleBar = document.getElementById("playlistTitleBar")
    Dom.playlistFooter = document.getElementById("playlistFooter")
    Dom.fileList = document.getElementById("fileList")
    Dom.fileListContainer = document.getElementById("fileListContainer")
    fileListContainerRect = Dom.fileListContainer.getBoundingClientRect();
    Dom.renameInput = document.getElementById("rename") as HTMLInputElement
    Dom.renameInput.addEventListener("blur", endEditFileName)
    Dom.renameInput.addEventListener("keydown", onRenameInputKeyDown)

    document.getElementById("closePlaylistBtn").addEventListener("click", () => window.api.send("close-playlist", null))

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