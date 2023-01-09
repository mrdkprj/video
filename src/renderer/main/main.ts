const Dom = {
    title: null as HTMLElement,
    resizeBtn:null as HTMLElement,
    video:null as HTMLVideoElement,
    source:null as HTMLSourceElement,
    loader:null as HTMLElement,
    viewport:null as HTMLElement,
    container:null as HTMLElement,
    currentTimeArea:null as HTMLElement,
    durationArea:null as HTMLElement,
    buttons:null as HTMLElement,
}

const timeSlider:Mp.Slider = {
    slider:null,
    track:null,
    thumb:null,
    rect:null,
    trackValue:null,
    handler:updateTime
}

const volumeSlider:Mp.Slider = {
    slider:null,
    track:null,
    thumb:null,
    rect:null,
    trackValue:null,
    handler:updateVolume
}

const ampSlider:Mp.Slider = {
    slider:null,
    track:null,
    thumb:null,
    rect:null,
    trackValue:null,
    handler:updateAmpLevel
}

const sliders:{[key:string]:Mp.Slider} = {
    time: timeSlider,
    volume: volumeSlider,
    amp: ampSlider,
}

const mediaState = {
    isMute:false,
    fitToWindow:false,
    videoDuration:0,
    videoVolume:0,
    ampLevel:0,
    gainNode:null as GainNode,
}

const slideState:Mp.SliderState = {
    sliding:false,
    startX:0,
    slider:undefined,
}

const FORWARD = 1;
const BACKWARD = -1;
const THUMB_RADIUS = 4;
const SLIDE_MARGIN = 8;

let containerRect:DOMRect;
let isMaximized:boolean;
let currentFile:Mp.MediaFile;

window.addEventListener("load", () => {
    Dom.title = document.getElementById("title");
    Dom.resizeBtn = document.getElementById("resizeBtn")
    Dom.viewport = document.getElementById("viewport");
    Dom.video = document.getElementById("video") as HTMLVideoElement
    Dom.source = document.getElementById("source") as HTMLSourceElement
    Dom.container = document.getElementById("container");
    Dom.buttons = document.getElementById("buttons")
    Dom.currentTimeArea = document.getElementById("videoCurrentTime")
    Dom.durationArea = document.getElementById("videoDuration")

    timeSlider.slider = document.getElementById("time")
    timeSlider.track = document.getElementById("timeTrack");
    timeSlider.thumb = document.getElementById("timeThumb");
    volumeSlider.slider = document.getElementById("volume");
    volumeSlider.track = document.getElementById("volumeTrack");
    volumeSlider.thumb = document.getElementById("volumeThumb");
    volumeSlider.trackValue = document.getElementById("volumeValue");
    ampSlider.slider = document.getElementById("amp");
    ampSlider.track = document.getElementById("ampTrack");
    ampSlider.thumb = document.getElementById("ampThumb");
    ampSlider.trackValue = document.getElementById("ampValue");

    containerRect = Dom.container.getBoundingClientRect();
    timeSlider.rect = timeSlider.slider.getBoundingClientRect();
    volumeSlider.rect = volumeSlider.slider.getBoundingClientRect();
    ampSlider.rect = ampSlider.slider.getBoundingClientRect();

    Dom.video.addEventListener("canplaythrough", () => onVideoLoaded())

    Dom.video.addEventListener("ended", () => changeIndex(FORWARD))

    Dom.video.addEventListener("timeupdate", () => onTimeUpdate())

    Dom.video.addEventListener("play", () => onPlayed())

    Dom.video.addEventListener("pause", () => {
        if(Dom.video.currentTime !== Dom.video.duration){
            onPaused();
        }
    })

    Dom.container.addEventListener("dragover", e => e.preventDefault())

    Dom.container.addEventListener("drop", e => {
        e.preventDefault();
        onFileDrop(e)
    });

});

document.addEventListener("click", e => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.id == "minimize"){
        minimize();
    }

    if(e.target.id == "maximize"){
        toggleMaximize();
    }

    if(e.target.id == "close"){
        close();
    }

    if(e.target.id === "playBtn"){
        togglePlay();
    }

    if(e.target.id === "stopBtn"){
        stop();
    }

    if(e.target.classList.contains("sound")){
        toggleMute();
    }

})

document.addEventListener("dblclick", e => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.classList.contains("main")){
        togglePlay()
    }

})

document.addEventListener("mousedown", e => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.id == "prevBtn"){
        playBackward(e.button);
    }

    if(e.target.id == "nextBtn"){
        playFoward(e.button);
    }

    if(e.target.classList.contains("thumb")){
        e.stopPropagation();
        startSlide(e);
    }

    if(e.target.id == "time" || e.target.id == "timeTrack"){
        const progress = (e.offsetX - SLIDE_MARGIN) / timeSlider.rect.width;
        updateTime(progress)
    }

    if(e.target.id == "volume" || e.target.id == "volumeTrack"){
        const progress = e.offsetX / volumeSlider.rect.width;
        updateVolume(progress);
    }

    if(e.target.id == "amp" || e.target.id == "ampTrack"){
        const progress = e.offsetX / ampSlider.rect.width;
        updateAmpLevel(progress);
    }
})

document.addEventListener("mousemove", e =>{
    moveSlider(e);
})

document.addEventListener("mouseup", e =>{
    if(slideState.sliding){
        e.preventDefault();
        e.stopPropagation();
        slideState.sliding = false;
    }
})

window.addEventListener("keydown", e => {

    if(e.ctrlKey && e.key === "r") e.preventDefault();

    if(e.key === "F5") window.api.send("reload");

    if(e.key === "ArrowRight"){

        if(e.shiftKey){
            changeCurrentTime(0.5)
        }else{
            playFoward(0);
        }
    }

    if(e.key === "ArrowLeft"){
        if(e.shiftKey){
            changeCurrentTime(-0.5)
        }else{
            playBackward(0);
        }
    }

    if(e.key === "p"){
        saveImage();
    }

    if(e.ctrlKey && e.key === "m"){
        toggleMute();
    }

    if(e.key === "Enter"){
        togglePlay();
    }
})

window.addEventListener("resize", () => {
    containerRect = Dom.container.getBoundingClientRect();
    timeSlider.rect = timeSlider.slider.getBoundingClientRect();
    volumeSlider.rect = volumeSlider.slider.getBoundingClientRect();
    changeVideoSize()
})

window.addEventListener("contextmenu", e => {

    if((e.target as HTMLElement).classList.contains("main")){
        e.preventDefault()
        window.api.send("open-main-context")
    }
})

function startSlide(e:MouseEvent){

    slideState.sliding = true;
    const target = (e.target as HTMLElement).getAttribute("data-target")
    slideState.slider = sliders[target];
    slideState.startX = e.offsetX
}

function moveSlider(e:MouseEvent){

    if(!slideState.sliding) return;

    const progress = (e.pageX - slideState.slider.rect.left - THUMB_RADIUS) / slideState.slider.rect.width

    if(progress > 1 || progress < 0) return;

    slideState.slider.handler(progress)

}

function updateTime(progress:number){
    Dom.video.currentTime = mediaState.videoDuration * progress;
}

function onTimeUpdate(){
    const duration = mediaState.videoDuration > 0 ? mediaState.videoDuration : 1
    const progress = (Dom.video.currentTime / duration) * 100;

    timeSlider.track.style.width = progress + "%"
    timeSlider.thumb.style.left  = progress + "%"
    Dom.currentTimeArea.textContent = formatTime(Dom.video.currentTime);

    window.api.send<Mp.ProgressArg>("progress", {progress:Dom.video.currentTime / duration})
}

function updateVolume(progress:number){
    Dom.video.volume = progress
    mediaState.videoVolume = Dom.video.volume;
    const value = `${mediaState.videoVolume * 100}%`;
    volumeSlider.track.style.width = value;
    volumeSlider.thumb.style.left = value;
    volumeSlider.thumb.title = value;
    volumeSlider.trackValue.textContent = `${parseInt(value)}%`;
}

function updateAmpLevel(progress:number){
    mediaState.ampLevel = progress;
    const value = `${mediaState.ampLevel * 100}%`;
    ampSlider.track.style.width = value;
    ampSlider.thumb.style.left = value;
    ampSlider.thumb.title = value;
    ampSlider.trackValue.textContent = `${parseInt(value)}%`;
    mediaState.gainNode.gain.value = mediaState.ampLevel * 10;
}

function onFileDrop(e:DragEvent){

    const dropFiles = Array.from(e.dataTransfer.items).filter(item => {
        return item.kind === "file" && (item.type.includes("video") || item.type.includes("audio"));
    })

    if(dropFiles.length > 0){
        window.api.send<Mp.DropRequest>("drop", {files:dropFiles.map(item => item.getAsFile().path), onPlaylist:false})
    }
}

function formatTime(secondValue:number){
    const hours = (Math.floor(secondValue / 3600)).toString().padStart(2, "0");
    const minutes = (Math.floor(secondValue % 3600 / 60)).toString().padStart(2, "0");
    const seconds = (Math.floor(secondValue % 3600 % 60)).toString().padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
}

function initPlayer(){
    Dom.source.src = "";
    Dom.title.textContent = "";
    document.title = "VidPlayer";
    mediaState.videoDuration = 0;
    Dom.durationArea.textContent = formatTime(mediaState.videoDuration);
    Dom.currentTimeArea.textContent = formatTime(0);
    currentFile = null;
    Dom.viewport.classList.remove("loaded");
    Dom.buttons.classList.remove("playing")
    Dom.video.load();
}

function releaseFile(){
    Dom.source.src = "";
    Dom.video.load();
}

function loadVideo(autoplay:boolean){
    Dom.source.src = currentFile.src
    const doAuthplay = autoplay ? autoplay : Dom.buttons.classList.contains("playing")
    Dom.video.autoplay = doAuthplay;
    Dom.video.muted = mediaState.isMute;
    Dom.video.load();
}

function onVideoLoaded(){

    document.title = `VidPlayer - ${currentFile.name}`
    Dom.title.textContent = currentFile.name
    changeVideoSize();

    mediaState.videoDuration = Dom.video.duration;

    Dom.durationArea.textContent = formatTime(mediaState.videoDuration);
    Dom.currentTimeArea.textContent = formatTime(Dom.video.currentTime);

    Dom.viewport.classList.add("loaded");

    Dom.video.autoplay = false;
}

function changeVideoSize(){

    if(mediaState.fitToWindow){
        const ratio = Math.min(containerRect.width / Dom.video.videoWidth, containerRect.height / Dom.video.videoHeight);
        Dom.video.style.width = `${Dom.video.videoWidth * ratio}px`
        Dom.video.style.height = `${Dom.video.videoHeight * ratio}px`
    }else{
        Dom.video.style.width = ""
        Dom.video.style.height = ""
    }
}

function amplify(){

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(Dom.video);

    mediaState.gainNode = audioCtx.createGain();
    updateAmpLevel(mediaState.ampLevel);
    source.connect(mediaState.gainNode);

    mediaState.gainNode.connect(audioCtx.destination);

}

function playFoward(button:number){

    if(!currentFile) return;

    if(button === 0){
        changeCurrentTime(10);
    }

    if(button === 2){
        changeIndex(FORWARD)
    }
}

function playBackward(button:number){

    if(!currentFile) return;

    if(button === 0){
        changeCurrentTime(-10)
    }

    if(button === 2){
        changeIndex(BACKWARD)
    }
}

function changeCurrentTime(time:number){

    const nextTime = Dom.video.currentTime + time;

    if(nextTime >= Dom.video.duration){
        return changeIndex(FORWARD)
    }

    if(nextTime < 0){
        return changeIndex(BACKWARD)
    }

    Dom.video.currentTime = nextTime;

}

function changeIndex(index:number){
    return window.api.send<Mp.LoadFileRequest>("load-file", {index, isAbsolute:false})
}

function togglePlay(){

    if(!currentFile) return;

    if(Dom.video.paused){
        Dom.video.play();
    }else{
        Dom.video.pause();
    }
}

function onPlayed(){
    window.api.send<Mp.ChangePlayStatusRequest>("played", {played:true})
    Dom.buttons.classList.add("playing")
}

function onPaused(){
    window.api.send<Mp.ChangePlayStatusRequest>("paused", {played:false})
    Dom.buttons.classList.remove("playing")
}

function stop(){

    if(!currentFile) return;

    window.api.send<Mp.ChangePlayStatusRequest>("paused", {played:false})
    Dom.buttons.classList.remove("playing")
    Dom.video.load();
}

function saveImage(){
    const canvas = document.createElement("canvas");
    const width = parseInt(Dom.video.style.width.replace("px", ""));
    const height = parseInt(Dom.video.style.height.replace("px", ""));
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(Dom.video, 0, 0, width, height);
    const image = canvas.toDataURL("image/jpeg").replace(/^data:image\/jpeg;base64,/, "");

    window.api.send<Mp.SaveImageRequet>("save-image", {data:image, timestamp:Dom.video.currentTime})
}

function toggleMute(){
    mediaState.isMute = !mediaState.isMute;
    Dom.video.muted = mediaState.isMute;
    if(mediaState.isMute){
        Dom.buttons.classList.add("mute")
    }else{
        Dom.buttons.classList.remove("mute")
    }
}

function changeMaximizeIcon(){
    if(isMaximized){
        Dom.resizeBtn.classList.remove("minbtn");
        Dom.resizeBtn.classList.add("maxbtn");
    }else{
        Dom.resizeBtn.classList.remove("maxbtn");
        Dom.resizeBtn.classList.add("minbtn");
    }
}

function minimize(){
    window.api.send("minimize")
}

function toggleMaximize(){
    window.api.send("toggle-maximize")
    isMaximized = !isMaximized;
    changeMaximizeIcon();
}

function onWindowSizeChanged(_isMaximized:boolean){
    isMaximized = _isMaximized;
    changeMaximizeIcon();
}

function close(){
    const config = {volume:mediaState.videoVolume, ampLevel:mediaState.ampLevel}
    window.api.send<Mp.SaveRequest>("close", config);
}

function prepare(config:Mp.Config){
    isMaximized = config.isMaximized;
    changeMaximizeIcon();

    mediaState.videoVolume = config.volume;
    updateVolume(mediaState.videoVolume);

    mediaState.ampLevel = config.ampLevel;
    amplify();

    mediaState.fitToWindow = config.fitToWindow;
}

function load(data:Mp.LoadFileResult){

    currentFile = data.currentFile;

    if(currentFile){
        loadVideo(data.autoPlay)
    }else{
        initPlayer();
    }
}

window.api.receive<Mp.Config>("config", (data:Mp.Config) => prepare(data))

window.api.receive<Mp.LoadFileResult>("play", (data:Mp.LoadFileResult) => load(data))

window.api.receive("toggle-play", () => togglePlay())

window.api.receive<Mp.Config>("change-display-mode", (data:Mp.Config) => {
    mediaState.fitToWindow = data.fitToWindow;
    changeVideoSize();
})

window.api.receive("reset", () => initPlayer())

window.api.receive<Mp.ErrorArgs>("error", (data:Mp.ErrorArgs) => alert(data.message))

window.api.receive("release-file", () => releaseFile())

window.api.receive<Mp.Config>("after-toggle-maximize", (data:Mp.Config) => onWindowSizeChanged(data.isMaximized))

window.api.receive<Mp.Logging>("log", data => console.log(data.log))

export {};