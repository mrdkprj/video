
let playlist;
let playlistTitleBar;
let fileList;

let current;
let selected;
const selection = [];
const dragState = {
    dragging: false,
    startElement:null,
    startIndex: -1,
    working:false,
}

window.addEventListener("load", e => {

    playlist = document.getElementById("playlist")
    playlistTitleBar = document.getElementById("playlistTitleBar")
    fileList = document.getElementById("fileList")
    document.getElementById("closePlaylistBtn").addEventListener("click", e => {
        window.api.send("close-playlist")
    })

    fileList.addEventListener("mouseleave", onMouseLeave)
})

window.addEventListener('contextmenu', e => {
    e.preventDefault()
    window.api.send("playlist-context", {targets:selection})
})

window.addEventListener("keydown", e => {

    if(e.ctrlKey && e.key === "r"){
        e.preventDefault();
    }

})

document.addEventListener("keydown", e =>{

    if(selection.length > 0){

        if(e.key === "Delete"){
            window.api.send("remove", {targets:selection})
        }
    }

})

document.addEventListener("mousedown", e => {

    if(e.target.classList.contains("playlist-item")){

        if(e.button === 2 && selection.length > 1){
            const clickedIndex = getChildIndex(e.target)
            if(selection.includes(clickedIndex)){
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

})

document.addEventListener("dragover", e => {
    e.preventDefault();
})

document.addEventListener("mouseup", e => {
    if(dragState.dragging){
        window.api.send("changeOrder", {start:dragState.startIndex, end:getChildIndex(dragState.startElement)})
    }
    dragState.dragging = false;
})

document.addEventListener("drop", e => {

    dragState.dragging = false;

    if(e.target.id === "fileListContainer"){
        e.preventDefault();
        return onFileDrop(e)
    }

})

function onMouseEnter(e){
    window.api.send("show-tooltip", {content: e.target.getAttribute("data-title"), position:{x:e.screenX, y:e.screenY}})

    movePlaylistItem(e);
}

function onMouseLeave(e){
    window.api.send("hide-tooltip")
}

function movePlaylistItem(e){

    if(!dragState.dragging) return;

    if(dragState.working){
        e.preventDefault();
        return
    }

    dragState.working = true;

    const dropRect = e.target.getBoundingClientRect();
    const dropPosition = e.clientY - dropRect.top;
    if(dropPosition <= dropRect.height){
        e.target.parentNode.insertBefore(dragState.startElement, e.target);
    }else{
        e.target.parentNode.insertBefore(e.target, dragState.startElement);
    }

    dragState.working = false;

}

function clearPlaylist(){
    fileList.innerHTML = "";
}

const onFileDrop = (e) => {

    const dropFiles = Array.from(e.dataTransfer.items).filter(item => {
        return item.kind === "file" && item.type.includes("video");
    })

    if(dropFiles.length > 0){
        window.api.send("drop", {files:dropFiles.map(item => item.getAsFile().path), playlist:true})
    }
}

function addPlaylist(files){

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

    fileList.appendChild(fragment)

}

function clearSelection(){
    selection.forEach(i => fileList.childNodes[i].classList.remove("selected"))
    selection.length = 0;
}

function toggleSelect(e){

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

function select(e){

    clearSelection();

    selected = e.target;

    selection.push(getChildIndex(selected))

    selected.classList.add("selected")
}

function selectByShift(e){

    clearSelection();

    const range = [];

    if(selected){
        range.push(getChildIndex(selected));
    }else{
        range.push(0);
    }

    range.push(getChildIndex(e.target));

    range.sort((a,b) => a - b);

    for(let i = range[0]; i <= range[1]; i++){
        selection.push(i);
        fileList.childNodes[i].classList.add("selected")
    }

}

function selectByCtrl(e){

    if(!selected){
        select(e);
        return;
    }

    const index = getChildIndex(e.target)

    selection.push(index)

    selection.sort((a,b) => a - b);

    e.target.classList.add("selected")
}

function onFileListItemClicked(e){
    const index = getChildIndex(e.target);
    window.api.send("selectFile", {index});
}

function getChildIndex(node) {
    return Array.prototype.indexOf.call(fileList.childNodes, node);
}

function changeCurrent(data){

    if(current){
        current.classList.remove("current");
    }

    if(data.current){
        current = document.getElementById(data.current.id);
        current.classList.add("current");
    }
}

const addFiles = (data) => {

    if(data.clear){
        clearPlaylist();
    }

    addPlaylist(data.files);
}

const removeFromPlaylist = (data) => {
    clearSelection();
    data.targets.map(index => fileList.childNodes[index]).forEach(node => fileList.removeChild(node))
}

window.api.receive("change-list", data => {
    addFiles(data);
})

window.api.receive("play", data => {
    changeCurrent(data)
})

window.api.receive("removed", data => {
    removeFromPlaylist(data)
})
