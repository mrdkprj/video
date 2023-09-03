import { DomElement } from "../dom"
import { FORWARD, BACKWARD } from "../../constants";

const Dom = {
    title: new DomElement("title"),
    resizeBtn: new DomElement("resizeBtn"),
    video: new DomElement<HTMLVideoElement>("video"),
    loader: new DomElement("loader"),
    viewport: new DomElement("viewport"),
    container: new DomElement("container"),
    currentTimeArea: new DomElement("videoCurrentTime"),
    durationArea: new DomElement("videoDuration"),
    buttons: new DomElement("buttons"),
    ampArea: new DomElement("ampArea"),
    convertState: new DomElement("convertState"),
}

const sliders:{[key:string]:Mp.Slider} = {}

const mediaState:Mp.MediaState = {
    mute:false,
    fitToWindow:false,
    videoDuration:0,
    videoVolume:0,
    ampLevel:0,
    gainNode:undefined,
    playbackRate:0,
    seekSpeed:0
}

const slideState:Mp.SliderState = {
    sliding:false,
    startX:0,
    slider:undefined,
}

const THUM_WIDTH = 8;

let containerRect:DOMRect;
let isMaximized:boolean;
let isFullScreen = false;
let currentFile:Mp.MediaFile;
let hideCursorTimeout:number;

const onClick = (e:MouseEvent) => {

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
}

const onDblClick = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.classList.contains("media")){
        togglePlay()
    }

}

const onMousedown = (e:MouseEvent) =>{

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
        const progress = (e.offsetX - 4) / sliders.Time.rect.width;
        updateTime(progress)
    }

    if(e.target.id == "volume" || e.target.id == "volumeTrack"){
        const progress = e.offsetX / sliders.Volume.rect.width;
        updateVolume(progress);
    }

    if(e.target.id == "amp" || e.target.id == "ampTrack"){
        const progress = e.offsetX / sliders.Amp.rect.width;
        updateAmpLevel(progress);
    }
}

const onMousemove = (e:MouseEvent) => {
    if(isFullScreen){
        Dom.viewport.element.classList.remove("autohide")
        window.clearTimeout(hideCursorTimeout)
        hideCursor();
    }

    moveSlider(e);
}

const onMouseup = (e:MouseEvent) => {
    endSlide(e);
}

const onKeydown = (e:KeyboardEvent) => {

    if(e.ctrlKey && e.key === "r") e.preventDefault();

    if(e.key === "F5") window.api.send("reload", {});

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

    if(e.ctrlKey && e.key === "ArrowUp"){
        updateVolume(mediaState.videoVolume + 0.01)
    }

    if(e.ctrlKey && e.key === "ArrowDown"){
        updateVolume(mediaState.videoVolume - 0.01)
    }

    if(e.key === "F11"){
        e.preventDefault();
        toggleFullscreen();
    }

    if(e.key === "Escape"){
        exitFullscreen();
    }

    if(e.key === "p"){
        captureScreen();
    }

    if(e.ctrlKey && e.key === "m"){
        toggleMute();
    }

    if(e.key === "Enter"){
        togglePlay();
    }
}

const onResize = () => {
    containerRect = Dom.container.element.getBoundingClientRect();
    sliders.Time.rect = sliders.Time.slider.getBoundingClientRect();
    sliders.Volume.rect = sliders.Volume.slider.getBoundingClientRect();
    sliders.Amp.rect = sliders.Amp.slider.getBoundingClientRect();
    changeVideoSize()
}

const onContextMenu = (e:MouseEvent) => {
    if((e.target as HTMLElement).classList.contains("media")){
        e.preventDefault()
        window.api.send("open-main-context", {})
    }
}

const startSlide = (e:MouseEvent) => {

    slideState.sliding = true;
    const target = (e.target as HTMLElement).getAttribute("data-target") ?? ""
    slideState.slider = sliders[target];
    slideState.startX = e.clientX
    slideState.slider.slider?.classList.add("sliding")
}

const moveSlider = (e:MouseEvent) => {

    if(!slideState.sliding || e.clientX == slideState.startX) return;

    if(!slideState.slider) return;

    const progress = (e.clientX - slideState.slider.rect.left) / slideState.slider.rect.width

    if(progress > 1 || progress < 0) return;

    slideState.slider.handler(progress)

}

const endSlide = (e:MouseEvent) => {
    if(slideState.sliding){
        e.preventDefault();
        e.stopPropagation();
        slideState.sliding = false;
        slideState.slider?.slider.classList.remove("sliding")
    }
}

const updateTime = (progress:number) => {
    Dom.video.element.currentTime = mediaState.videoDuration * progress;
}

const onTimeUpdate = () => {
    const duration = mediaState.videoDuration > 0 ? mediaState.videoDuration : 1
    const progress = (Dom.video.element.currentTime / duration) * 100;
    const progressRate = `${progress}%`;

    sliders.Time.track.style.width = progressRate
    sliders.Time.thumb.style.left = `max(${progressRate} - ${THUM_WIDTH}px, 0px)`;
    Dom.currentTimeArea.element.textContent = formatTime(Dom.video.element.currentTime);

    window.api.send("progress", {progress:Dom.video.element.currentTime / duration})
}

const updateVolume = (volume:number) => {
    Dom.video.element.volume = volume
    mediaState.videoVolume = Dom.video.element.volume;
    const progress = Math.floor(mediaState.videoVolume * 100)
    const progressRate = `${progress}%`;
    sliders.Volume.track.style.width = progressRate;
    sliders.Volume.thumb.style.left = `max(${progressRate} - ${THUM_WIDTH}px, 0px)`;
    sliders.Volume.thumb.title = progressRate;
    sliders.Volume.trackValue.textContent = progressRate;
}

const updateAmpLevel = (ampLevel:number) => {
    mediaState.ampLevel = ampLevel;
    const progress = Math.floor(mediaState.ampLevel * 100)
    const progressRate = `${progress}%`;
    sliders.Amp.track.style.width = progressRate;
    sliders.Amp.thumb.style.left = `max(${progressRate} - ${THUM_WIDTH}px, 0px)`;
    sliders.Amp.thumb.title = progressRate;
    sliders.Amp.trackValue.textContent = progressRate;
    if(mediaState.gainNode){
        mediaState.gainNode.gain.value = mediaState.ampLevel * 10;
    }
}

const onFileDrop = (e:DragEvent) => {

    e.preventDefault();

    const items = e.dataTransfer ? e.dataTransfer.items : []

    const dropItems = Array.from(items).filter(item => {
        return item.kind === "file" && (item.type.includes("video") || item.type.includes("audio"));
    })

    if(dropItems.length){
        const files = dropItems.map(item => item.getAsFile()?.path ?? "")
        window.api.send("drop", {files, renderer:"Player"})
    }
}

const formatTime = (secondValue:number) => {
    const hours = (Math.floor(secondValue / 3600)).toString().padStart(2, "0");
    const minutes = (Math.floor(secondValue % 3600 / 60)).toString().padStart(2, "0");
    const seconds = (Math.floor(secondValue % 3600 % 60)).toString().padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
}

const initPlayer = () => {
    clearTimeTrackTitle()
    Dom.video.element.src = "";
    Dom.title.element.textContent = "";
    document.title = "MediaPlayer";
    mediaState.videoDuration = 0;
    Dom.durationArea.element.textContent = formatTime(mediaState.videoDuration);
    Dom.currentTimeArea.element.textContent = formatTime(0);
    Dom.viewport.element.classList.remove("loaded");
    Dom.buttons.element.classList.remove("playing")
    Dom.video.element.load();
}

const releaseFile = () => {
    Dom.video.element.src = "";
    Dom.video.element.load();
}

const beforeDelete = (data:Mp.ReleaseFileRequest) => {
    if(data.fileIds.includes(currentFile.id)){
        releaseFile();
    }
    window.api.send("file-released", {fileIds:data.fileIds})
}

const loadMedia = (e:Mp.FileLoadEvent) => {
    clearTimeTrackTitle()
    currentFile = e.currentFile;
    Dom.video.element.src = currentFile.src ? `${currentFile.src}?${new Date().getTime()}` : ""
    Dom.video.element.autoplay = e.autoPlay ? e.autoPlay : Dom.buttons.element.classList.contains("playing");
    Dom.video.element.muted = mediaState.mute;
    Dom.video.element.playbackRate = mediaState.playbackRate
    Dom.video.element.load();
}

const onMediaLoaded = () => {

    document.title = `MediaPlayer - ${currentFile.name}`
    Dom.title.element.textContent = currentFile.name
    changeVideoSize();

    mediaState.videoDuration = Dom.video.element.duration;

    Dom.durationArea.element.textContent = formatTime(mediaState.videoDuration);
    Dom.currentTimeArea.element.textContent = formatTime(Dom.video.element.currentTime);

    Dom.viewport.element.classList.add("loaded");

    Dom.video.element.autoplay = false;
}

const changeVideoSize = () => {

    if(mediaState.fitToWindow && containerRect.height > Dom.video.element.videoHeight){
        const ratio = Math.min(containerRect.width / Dom.video.element.videoWidth, containerRect.height / Dom.video.element.videoHeight);
        Dom.video.element.style.height = `${Dom.video.element.videoHeight * ratio}px`
    }else{
        Dom.video.element.style.height = ""
    }
}

const amplify = () => {

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(Dom.video.element);

    mediaState.gainNode = audioCtx.createGain();
    updateAmpLevel(mediaState.ampLevel);
    source.connect(mediaState.gainNode);

    mediaState.gainNode.connect(audioCtx.destination);

}

const playFoward = (button:number) => {

    if(!currentFile) return;

    if(button === 0){
        changeCurrentTime(mediaState.seekSpeed);
    }

    if(button === 2){
        changeFile(FORWARD)
    }
}

const playBackward = (button:number) => {

    if(!currentFile) return;

    if(button === 0){
        changeCurrentTime(-mediaState.seekSpeed)
    }

    if(button === 2){
        changeFile(BACKWARD)
    }
}

const changeCurrentTime = (time:number) => {

    const nextTime = Dom.video.element.currentTime + time;

    if(nextTime >= Dom.video.element.duration){
        return changeFile(FORWARD)
    }

    if(nextTime < 0){
        return changeFile(BACKWARD)
    }

    Dom.video.element.currentTime = nextTime;

}

const changeFile = (index:number) => {
    return window.api.send("load-file", {index, isAbsolute:false})
}

const togglePlay = () => {

    if(!currentFile) return;

    if(Dom.video.element.paused){
        Dom.video.element.play();
    }else{
        Dom.video.element.pause();
    }
}

const onPlayed = () => {
    window.api.send("play-status-change", {status:"playing"})
    Dom.buttons.element.classList.add("playing")
}

const onPaused = () => {

    if(Dom.video.element.currentTime == Dom.video.element.duration) return;

    window.api.send("play-status-change", {status:"paused"})
    Dom.buttons.element.classList.remove("playing")
}

const stop = () => {

    if(!currentFile) return;

    window.api.send("play-status-change", {status:"stopped"})
    Dom.buttons.element.classList.remove("playing")
    Dom.video.element.load();
}

const changePlaybackRate = (data:Mp.ChangePlaybackRateRequest) => {
    mediaState.playbackRate = data.playbackRate
    Dom.video.element.playbackRate = mediaState.playbackRate
}

const changeSeekSpeed = (data:Mp.ChangeSeekSpeedRequest) => {
    mediaState.seekSpeed = data.seekSpeed;
}

const captureScreen = () => {
    const canvas = document.createElement("canvas");
    const width = parseInt(Dom.video.element.style.width.replace("px", ""));
    const height = parseInt(Dom.video.element.style.height.replace("px", ""));
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if(context){
        context.drawImage(Dom.video.element, 0, 0, width, height);
    }
    const image = canvas.toDataURL("image/jpeg").replace(/^data:image\/jpeg;base64,/, "");

    window.api.send("save-image", {data:image, timestamp:Dom.video.element.currentTime})
}

const toggleMute = () => {
    mediaState.mute = !mediaState.mute;
    Dom.video.element.muted = mediaState.mute;
    if(mediaState.mute){
        Dom.ampArea.element.classList.add("mute")
    }else{
        Dom.ampArea.element.classList.remove("mute")
    }
}

const changeMaximizeIcon = () => {
    if(isMaximized){
        Dom.resizeBtn.element.classList.remove("minbtn");
        Dom.resizeBtn.element.classList.add("maxbtn");
    }else{
        Dom.resizeBtn.element.classList.remove("maxbtn");
        Dom.resizeBtn.element.classList.add("minbtn");
    }
}

const minimize = () => {
    window.api.send("minimize", {})
}

const toggleMaximize = () => {
    window.api.send("toggle-maximize", {})
    isMaximized = !isMaximized;
    changeMaximizeIcon();
}

const onWindowSizeChanged = (e:Mp.ConfigChangeEvent) => {
    isMaximized = e.config.isMaximized;
    changeMaximizeIcon();
}

const toggleFullscreen = () => {

    if(isFullScreen){
        exitFullscreen()
    }else{
        enterFullscreen()
    }
}

const exitFullscreen = () => {
    isFullScreen = false;
    Dom.viewport.element.classList.remove("full-screen")
    if(hideCursorTimeout){
        window.clearTimeout(hideCursorTimeout)
    }
    Dom.viewport.element.classList.remove("autohide")
    window.api.send("toggle-fullscreen", {fullscreen:isFullScreen})
}

const enterFullscreen = () => {
    isFullScreen = true;
    Dom.viewport.element.classList.add("full-screen")
    hideCursor()
    window.api.send("toggle-fullscreen", {fullscreen:isFullScreen})
}

const hideCursor = () => {
    hideCursorTimeout = window.setTimeout(() => {
        Dom.viewport.element.classList.add("autohide")
    },2000)
}

const toggleConvert = () => {
    if(Dom.viewport.element.classList.contains("converting")){
        Dom.viewport.element.classList.remove("converting")
    }else{
        Dom.viewport.element.classList.add("converting")
    }
}

const onChangeDisplayMode = (e:Mp.ConfigChangeEvent) => {
    mediaState.fitToWindow = e.config.video.fitToWindow;
    changeVideoSize();
}

const close = () => {
    window.api.send("close", {mediaState});
}

const prepare = (e:Mp.ReadyEvent) => {
    isMaximized = e.config.isMaximized;
    changeMaximizeIcon();

    mediaState.videoVolume = e.config.audio.volume;
    updateVolume(mediaState.videoVolume);

    mediaState.ampLevel = e.config.audio.ampLevel;
    amplify();

    mediaState.mute = !e.config.audio.mute
    toggleMute();

    mediaState.fitToWindow = e.config.video.fitToWindow;
    mediaState.playbackRate = e.config.video.playbackRate;
    mediaState.seekSpeed = e.config.video.seekSpeed;
}

const load = (e:Mp.FileLoadEvent) => {

    if(e.currentFile.id){
        loadMedia(e)
    }else{
        initPlayer();
    }

}

const setTimeTrackTitle = (e:MouseEvent) => {

    if(!Dom.video.element.duration) return;

    const progress = (e.offsetX) / sliders.Time.rect.width;
    const time = formatTime(Dom.video.element.duration * progress)
    sliders.Time.slider.title = time;

}

const clearTimeTrackTitle = () => {
    sliders.Time.slider.title = ""
}

const prepareSliders = () => {
    sliders.Time = {
        slider: new DomElement("time").fill(),
        track: new DomElement("timeTrack").fill(),
        thumb: new DomElement("timeThumb").fill(),
        rect: new DomElement("time").fill().getBoundingClientRect(),
        handler: updateTime,
    }

    sliders.Volume = {
        slider:new DomElement("volume").fill(),
        track:new DomElement("volumeTrack").fill(),
        thumb:new DomElement("volumeThumb").fill(),
        rect: new DomElement("volume").fill().getBoundingClientRect(),
        trackValue:new DomElement("volumeValue").fill(),
        handler:updateVolume
    }

    sliders.Amp = {
        slider:new DomElement("amp").fill(),
        track:new DomElement("ampTrack").fill(),
        thumb:new DomElement("ampThumb").fill(),
        rect: new DomElement("amp").fill().getBoundingClientRect(),
        trackValue:new DomElement("ampValue").fill(),
        handler:updateAmpLevel
    }


    sliders.Time.slider.addEventListener("mouseenter", setTimeTrackTitle)
    sliders.Time.slider.addEventListener("mouseleave", clearTimeTrackTitle)
    sliders.Time.slider.addEventListener("mousemove", setTimeTrackTitle)
}

window.api.receive("ready", prepare)
window.api.receive("after-file-load", load)
window.api.receive("toggle-play", togglePlay)
window.api.receive("change-display-mode", onChangeDisplayMode)
window.api.receive("restart", initPlayer)
window.api.receive("release-file", beforeDelete)
window.api.receive("after-toggle-maximize", onWindowSizeChanged)
window.api.receive("toggle-convert", toggleConvert)
window.api.receive("change-playback-rate", changePlaybackRate)
window.api.receive("change-seek-speed", changeSeekSpeed);
window.api.receive("toggle-fullscreen", toggleFullscreen)
window.api.receive("log", data => console.log(data.log))

window.addEventListener("load", () => {
    Dom.title.fill();
    Dom.resizeBtn.fill()
    Dom.viewport.fill();
    Dom.video.fill()
    Dom.container.fill()
    Dom.buttons.fill()
    Dom.currentTimeArea .fill()
    Dom.durationArea.fill()
    Dom.ampArea.fill()
    Dom.convertState.fill()

    containerRect = Dom.container.element.getBoundingClientRect();

    Dom.video.element.addEventListener("canplaythrough", onMediaLoaded)
    Dom.video.element.addEventListener("ended", () => changeFile(FORWARD))
    Dom.video.element.addEventListener("timeupdate", onTimeUpdate)
    Dom.video.element.addEventListener("play", onPlayed)
    Dom.video.element.addEventListener("pause", onPaused);

    Dom.container.element.addEventListener("dragover", e => e.preventDefault())
    Dom.container.element.addEventListener("drop",  onFileDrop);

    prepareSliders();

});

window.addEventListener("keydown", onKeydown)
window.addEventListener("resize", onResize)
window.addEventListener("contextmenu", onContextMenu)

document.addEventListener("click", onClick)
document.addEventListener("dblclick", onDblClick)
document.addEventListener("mousedown", onMousedown)
document.addEventListener("mousemove", onMousemove)
document.addEventListener("mouseup", onMouseup)

export {};