const Dom = {
    playlist: null as HTMLElement,
    playlistTitleBar:null as HTMLElement,
    playlistFooter:null as HTMLElement,
    fileList:null as HTMLElement,
    fileListContainer:null as HTMLElement,
}

const selection:string[] = [];

const dragState:Mp.PlaylistDragState = {
    dragging: false,
    startElement:null,
    startIndex: -1,
    working:false,
}

let currentElement:HTMLElement;
let selectedElement:HTMLElement;
let fileListContainerRect:DOMRect;
let mouseEnterDisabled = false;

window.addEventListener("load", () => {

    Dom.playlist = document.getElementById("playlist")
    Dom.playlistTitleBar = document.getElementById("playlistTitleBar")
    Dom.playlistFooter = document.getElementById("playlistFooter")
    Dom.fileList = document.getElementById("fileList")
    Dom.fileListContainer = document.getElementById("fileListContainer")
    fileListContainerRect = Dom.fileListContainer.getBoundingClientRect();
    document.getElementById("closePlaylistBtn").addEventListener("click", () => window.api.send("close-playlist"))

    Dom.fileList.addEventListener("mouseleave", onMouseLeave)

    Dom.playlist.addEventListener("mouseleave", onMouseLeave)

    window.addEventListener("resize", () => {
        fileListContainerRect = Dom.fileListContainer.getBoundingClientRect()
    })

})

window.addEventListener("contextmenu", e => {
    e.preventDefault()
    window.api.send<Mp.OpenPlaylistContextRequest>("open-playlist-context", {selectedFileRange:selection})
})

window.addEventListener("keydown", e => {

    if(e.ctrlKey && e.key === "r") e.preventDefault();

    if(e.key === "Enter") window.api.send("toggle-play")

})

document.addEventListener("keydown", e =>{

    if(selection.length > 0){

        if(e.key === "Delete"){
            window.api.send<Mp.RemovePlaylistRequest>("remove", {selectedFileRange:selection})
        }
    }

    if(e.ctrlKey && e.key === "a"){
        selectAll();
    }

})

document.addEventListener("click", e => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.id === "shuffleBtn"){
        toggleShuffle();
    }

})

document.addEventListener("mousedown", onMouseDown);

document.addEventListener("dragover", e => {
    e.preventDefault();
})

document.addEventListener("mouseup", onMouseUp);

document.addEventListener("drop", e => {
    onFileDrop(e)
})

function onMouseDown(e:MouseEvent){

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.classList.contains("playlist-item")){

        window.api.send("hide-tooltip")

        e.stopPropagation();

        if(e.button === 2 && selection.length > 1){
            if(selection.includes(e.target.id)){
                return;
            }
        }

        toggleSelect(e)

        if(selection.length > 1) return;

        dragState.dragging = true;
        dragState.startElement = e.target;
        dragState.startIndex = getChildIndex(e.target)

    }else{
        clearSelection();
    }
}

function onMouseUp(_e:MouseEvent){
    if(dragState.dragging){
        const args = {start:dragState.startIndex, end:getChildIndex(dragState.startElement), currentIndex:getChildIndex(currentElement)}
        window.api.send<Mp.ChangePlaylistOrderRequet>("change-playlist-order", args);
    }
    dragState.dragging = false;
}

function onMouseEnter(e:MouseEvent){

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(!dragState.dragging && !mouseEnterDisabled){
        window.api.send<Mp.PrepareTooltipRequest>("prepare-tooltip", {fileName: e.target.getAttribute("data-title"), position:{x:e.screenX, y:e.screenY}})
    }

    movePlaylistItem(e);
}

function onMouseLeave(){
    window.api.send("hide-tooltip")
}

function movePlaylistItem(e:MouseEvent){

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(!dragState.dragging) return;

    if(dragState.working){
        e.preventDefault();
        return
    }

    dragState.working = true;

    const currentIndex = selection.indexOf(dragState.startElement.id);
    const dropRect = e.target.getBoundingClientRect();
    const dropPosition = e.clientY - dropRect.top;
    if(dropPosition <= dropRect.height){
        e.target.parentNode.insertBefore(dragState.startElement, e.target);
    }else{
        e.target.parentNode.insertBefore(e.target, dragState.startElement);
    }
    selection[currentIndex] = dragState.startElement.id;

    dragState.working = false;

}

function clearPlaylist(){
    Dom.fileList.innerHTML = "";
}

function onFileDrop(e:DragEvent){

    e.preventDefault();
    e.stopPropagation();

    dragState.dragging = false;

    const dropFiles = Array.from(e.dataTransfer.items).filter(item => {
        return item.kind === "file" && (item.type.includes("video") || item.type.includes("audio"));
    })

    if(dropFiles.length > 0){
        window.api.send<Mp.DropRequest>("drop", {files:dropFiles.map(item => item.getAsFile().path), onPlaylist:true})
    }
}

function addPlaylist(files:Mp.MediaFile[]){

    const fragment = document.createDocumentFragment();

    files.forEach(file => {

        const item = document.createElement("li");
        item.textContent = file.name;
        item.setAttribute("data-title", file.name)
        item.id = file.id;
        item.classList.add("playlist-item")
        item.addEventListener("dblclick", onFileListItemClicked);
        item.addEventListener("mouseenter", onMouseEnter)
        item.addEventListener("mouseleave", movePlaylistItem)

        fragment.appendChild(item);

    });

    Dom.fileList.appendChild(fragment)

    preventMouseEnter();

}

const removeFromPlaylist = (data:Mp.RemovePlaylistResult) => {
    preventMouseEnter();
    clearSelection();
    const targetNodes = data.removedFileIds.map(id => document.getElementById(id))
    targetNodes.forEach(node => {
        if(currentElement && node.id === currentElement.id){
            currentElement = null;
        }
        Dom.fileList.removeChild(node)
    })
}

function preventMouseEnter(){
    mouseEnterDisabled = true;
    setTimeout(() => {
        mouseEnterDisabled = false;
    }, 500);
}

function clearSelection(){
    selection.forEach(id => document.getElementById(id).classList.remove("selected"))
    selection.length = 0;
}

function toggleSelect(e:MouseEvent){

    if(e.ctrlKey){
        selectByCtrl(e)
        return;
    }

    if(e.shiftKey){
        selectByShift(e);
        return
    }

    select(e);

}

function select(e:MouseEvent){

    clearSelection();

    selectedElement = e.target as HTMLElement;

    selection.push(selectedElement.id)

    selectedElement.classList.add("selected")
}

function selectByShift(e:MouseEvent){

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
        selection.push(Dom.fileList.children[i].id);
        Dom.fileList.children[i].classList.add("selected")
    }

}

function selectByCtrl(e:MouseEvent){

    if(!selectedElement){
        select(e);
        return;
    }

    const target = (e.target as HTMLElement);
    selection.push(target.id)

    target.classList.add("selected")
}

function selectAll(){

    clearSelection();

    Array.from(Dom.fileList.children).forEach((node,_index) => {
        node.classList.add("selected")
        selection.push(node.id);
    })

}

function onFileListItemClicked(e:MouseEvent){
    const index = getChildIndex(e.target as HTMLElement);
    window.api.send<Mp.LoadFileRequest>("load-file", {index, isAbsolute:true});
}

function getChildIndex(node:HTMLElement) {
    if(!node) return -1;

    return Array.prototype.indexOf.call(Dom.fileList.childNodes, node);
}

function changeCurrent(data:Mp.LoadFileResult){

    if(currentElement){
        currentElement.classList.remove("current");
    }

    if(data.currentFile){
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

function addFiles(data:Mp.DropResult){

    if(data.clearPlaylist){
        clearPlaylist();
    }

    addPlaylist(data.files);

}

function reset(){
    currentElement = null;
    selectedElement = null;
    mouseEnterDisabled = false;
    selection.length = 0;
    clearPlaylist();
}

function toggleShuffle(){

    if(Dom.playlistFooter.classList.contains("shuffle")){
        Dom.playlistFooter.classList.remove("shuffle")
    }else{
        Dom.playlistFooter.classList.add("shuffle")
    }

    window.api.send("toggle-shuffle")
}

function sortList(fileIds:string[]){

    const lists = Array.from(Dom.fileList.children)

    lists.sort((a,b) => fileIds.indexOf(a.id) - fileIds.indexOf(b.id))

    Dom.fileList.innerHTML = "";
    lists.forEach(li => Dom.fileList.appendChild(li))

}

window.api.receive<Mp.DropResult>("after-drop", (data:Mp.DropResult) => addFiles(data))

window.api.receive<Mp.LoadFileResult>("play", (data: Mp.LoadFileResult) => changeCurrent(data))

window.api.receive<Mp.RemovePlaylistResult>("after-remove-playlist", (data: Mp.RemovePlaylistResult) => removeFromPlaylist(data))

window.api.receive<Mp.SortResult>("after-sort", (data:Mp.SortResult) => sortList(data.fileIds))

window.api.receive("reset", () => reset())

export {}