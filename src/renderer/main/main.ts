import { FORWARD, BACKWARD } from "../../constants";

const Dom = {
    title: null as HTMLElement,
    resizeBtn:null as HTMLElement,
    video:null as HTMLVideoElement,
    loader:null as HTMLElement,
    viewport:null as HTMLElement,
    container:null as HTMLElement,
    currentTimeArea:null as HTMLElement,
    durationArea:null as HTMLElement,
    buttons:null as HTMLElement,
    ampArea:null as HTMLElement,
    setting:null as HTMLElement,
    convertState:null as HTMLElement,
}

const sliders:Mp.Sliders = {
    Time: null,
    Volume: null,
    Amp: null,
}

const mediaState:Mp.MediaState = {
    mute:false,
    fitToWindow:false,
    videoDuration:0,
    videoVolume:0,
    ampLevel:0,
    gainNode:null,
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

const onMouseup = (e:MouseEvent) => {
    endSlide(e);
}

const onKeydown = (e:KeyboardEvent) => {

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

    if(e.ctrlKey && e.key === "ArrowUp"){
        updateVolume(mediaState.videoVolume + 0.01)
    }

    if(e.ctrlKey && e.key === "ArrowDown"){
        updateVolume(mediaState.videoVolume - 0.01)
    }

    if(e.key === "F1" || e.key === "Escape"){
        toggleFullScreen();
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
}

const onResize = () => {
    containerRect = Dom.container.getBoundingClientRect();
    sliders.Time.rect = sliders.Time.slider.getBoundingClientRect();
    sliders.Volume.rect = sliders.Volume.slider.getBoundingClientRect();
    sliders.Amp.rect = sliders.Amp.slider.getBoundingClientRect();
    changeVideoSize()
}

const onContextMenu = (e:MouseEvent) => {
    if((e.target as HTMLElement).classList.contains("media")){
        e.preventDefault()
        window.api.send("open-main-context")
    }
}

const prepareSliders = () => {
    const timeSlider:Mp.Slider = {
        slider: document.getElementById("time"),
        track:document.getElementById("timeTrack"),
        thumb:document.getElementById("timeThumb"),
        rect:null,
        handler: updateTime,
    }

    const volumeSlider:Mp.Slider = {
        slider:document.getElementById("volume"),
        track:document.getElementById("volumeTrack"),
        thumb:document.getElementById("volumeThumb"),
        rect:null,
        trackValue:document.getElementById("volumeValue"),
        handler:updateVolume
    }

    const ampSlider:Mp.Slider = {
        slider:document.getElementById("amp"),
        track:document.getElementById("ampTrack"),
        thumb:document.getElementById("ampThumb"),
        rect:null,
        trackValue:document.getElementById("ampValue"),
        handler:updateAmpLevel
    }

    timeSlider.rect = timeSlider.slider.getBoundingClientRect();
    volumeSlider.rect = volumeSlider.slider.getBoundingClientRect();
    ampSlider.rect = ampSlider.slider.getBoundingClientRect();

    sliders.Time = timeSlider;
    sliders.Volume = volumeSlider;
    sliders.Amp = ampSlider;
}

const startSlide = (e:MouseEvent) => {

    slideState.sliding = true;
    const target = (e.target as HTMLElement).getAttribute("data-target")
    slideState.slider = sliders[target as keyof Mp.Sliders];
    slideState.startX = e.clientX
    slideState.slider.slider.classList.add("sliding")
}

const moveSlider = (e:MouseEvent) => {

    if(!slideState.sliding || e.clientX == slideState.startX) return;

    const progress = (e.clientX - slideState.slider.rect.left) / slideState.slider.rect.width

    if(progress > 1 || progress < 0) return;

    slideState.slider.handler(progress)

}

const endSlide = (e:MouseEvent) => {
    if(slideState.sliding){
        e.preventDefault();
        e.stopPropagation();
        slideState.sliding = false;
        slideState.slider.slider.classList.remove("sliding")
    }
}

const updateTime = (progress:number) => {
    Dom.video.currentTime = mediaState.videoDuration * progress;
}

const onTimeUpdate = () => {
    const duration = mediaState.videoDuration > 0 ? mediaState.videoDuration : 1
    const progress = (Dom.video.currentTime / duration) * 100;
    const progressRate = `${progress}%`;

    sliders.Time.track.style.width = progressRate
    sliders.Time.thumb.style.left = `max(${progressRate} - ${THUM_WIDTH}px, 0px)`;
    Dom.currentTimeArea.textContent = formatTime(Dom.video.currentTime);

    window.api.send<Mp.OnProgress>("progress", {progress:Dom.video.currentTime / duration})
}

const updateVolume = (volume:number) => {
    Dom.video.volume = volume
    mediaState.videoVolume = Dom.video.volume;
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
    mediaState.gainNode.gain.value = mediaState.ampLevel * 10;
}

const onFileDrop = (e:DragEvent) => {

    e.preventDefault();

    const dropFiles = Array.from(e.dataTransfer.items).filter(item => {
        return item.kind === "file" && (item.type.includes("video") || item.type.includes("audio"));
    })

    if(dropFiles.length > 0){
        window.api.send<Mp.DropRequest>("drop", {files:dropFiles.map(item => item.getAsFile().path), renderer:"Main"})
    }
}

const formatTime = (secondValue:number) => {
    const hours = (Math.floor(secondValue / 3600)).toString().padStart(2, "0");
    const minutes = (Math.floor(secondValue % 3600 / 60)).toString().padStart(2, "0");
    const seconds = (Math.floor(secondValue % 3600 % 60)).toString().padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
}

const initPlayer = () => {
    Dom.video.src = "";
    Dom.title.textContent = "";
    document.title = "MediaPlayer";
    mediaState.videoDuration = 0;
    Dom.durationArea.textContent = formatTime(mediaState.videoDuration);
    Dom.currentTimeArea.textContent = formatTime(0);
    currentFile = null;
    Dom.viewport.classList.remove("loaded");
    Dom.buttons.classList.remove("playing")
    Dom.video.load();
}

const releaseFile = () => {
    Dom.video.src = "";
    Dom.video.load();
}

const beforeDelete = (data:Mp.ReleaseFileRequest) => {
    if(data.fileIds.includes(currentFile.id)){
        releaseFile();
    }
    window.api.send("file-released")
}

const loadMedia = (autoplay:boolean) => {
    Dom.video.src = currentFile.src ? `${currentFile.src}?${new Date().getTime()}` : ""
    Dom.video.autoplay = autoplay ? autoplay : Dom.buttons.classList.contains("playing");
    Dom.video.muted = mediaState.mute;
    Dom.video.playbackRate = mediaState.playbackRate
    Dom.video.load();
}

const replaceMedia = (data:Mp.ReplaceFileRequest) => {
    currentFile = data.file;
    Dom.video.src = currentFile.src ? `${currentFile.src}?${new Date().getTime()}` : ""
}

const onMediaLoaded = () => {

    document.title = `MediaPlayer - ${currentFile.name}`
    Dom.title.textContent = currentFile.name
    changeVideoSize();

    mediaState.videoDuration = Dom.video.duration;

    Dom.durationArea.textContent = formatTime(mediaState.videoDuration);
    Dom.currentTimeArea.textContent = formatTime(Dom.video.currentTime);

    Dom.viewport.classList.add("loaded");

    Dom.video.autoplay = false;
}

const changeVideoSize = () => {

    if(mediaState.fitToWindow){
        const ratio = Math.min(containerRect.width / Dom.video.videoWidth, containerRect.height / Dom.video.videoHeight);
        Dom.video.style.width = `${Dom.video.videoWidth * ratio}px`
        Dom.video.style.height = `${Dom.video.videoHeight * ratio}px`
    }else{
        Dom.video.style.width = ""
        Dom.video.style.height = ""
    }
}

const amplify = () => {

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(Dom.video);

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

    const nextTime = Dom.video.currentTime + time;

    if(nextTime >= Dom.video.duration){
        return changeFile(FORWARD)
    }

    if(nextTime < 0){
        return changeFile(BACKWARD)
    }

    Dom.video.currentTime = nextTime;

}

const changeFile = (index:number) => {
    return window.api.send<Mp.LoadFileRequest>("load-file", {index, isAbsolute:false})
}

const togglePlay = () => {

    if(!currentFile) return;

    if(Dom.video.paused){
        Dom.video.play();
    }else{
        Dom.video.pause();
    }
}

const onPlayed = () => {
    window.api.send<Mp.ChangePlayStatusRequest>("play-status-change", {status:"playing"})
    Dom.buttons.classList.add("playing")
}

const onPaused = () => {

    if(Dom.video.currentTime == Dom.video.duration) return;

    window.api.send<Mp.ChangePlayStatusRequest>("play-status-change", {status:"paused"})
    Dom.buttons.classList.remove("playing")
}

const stop = () => {

    if(!currentFile) return;

    window.api.send<Mp.ChangePlayStatusRequest>("play-status-change", {status:"stopped"})
    Dom.buttons.classList.remove("playing")
    Dom.video.load();
}

const changePlaybackRate = (data:Mp.ChangePlaySpeedRequest) => {
    mediaState.playbackRate = data.playbackRate
    Dom.video.playbackRate = mediaState.playbackRate
}

const changeSeekSpeed = (data:Mp.ChangePlaySpeedRequest) => {
    mediaState.seekSpeed = data.seekSpeed;
}

const saveImage = () => {
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

const toggleMute = () => {
    mediaState.mute = !mediaState.mute;
    Dom.video.muted = mediaState.mute;
    if(mediaState.mute){
        Dom.ampArea.classList.add("mute")
    }else{
        Dom.ampArea.classList.remove("mute")
    }
}

const changeMaximizeIcon = () => {
    if(isMaximized){
        Dom.resizeBtn.classList.remove("minbtn");
        Dom.resizeBtn.classList.add("maxbtn");
    }else{
        Dom.resizeBtn.classList.remove("maxbtn");
        Dom.resizeBtn.classList.add("minbtn");
    }
}

const minimize = () => {
    window.api.send("minimize")
}

const toggleMaximize = () => {
    window.api.send("toggle-maximize")
    isMaximized = !isMaximized;
    changeMaximizeIcon();
}

const onWindowSizeChanged = (e:Mp.ConfigChanged) => {
    isMaximized = e.config.isMaximized;
    changeMaximizeIcon();
}

const toggleFullScreen = () => {

    if(isFullScreen){
        Dom.viewport.classList.remove("full-screen")
    }else{
        Dom.viewport.classList.add("full-screen")
    }

    isFullScreen = !isFullScreen;

    window.api.send("toggle-fullscreen")
}

const toggleConvert = () => {
    if(Dom.viewport.classList.contains("converting")){
        Dom.viewport.classList.remove("converting")
    }else{
        Dom.viewport.classList.add("converting")
    }
}

const onChangeDisplayMode = (e:Mp.ConfigChanged) => {
    mediaState.fitToWindow = e.config.video.fitToWindow;
    changeVideoSize();
}

const close = () => {
    window.api.send<Mp.CloseRequest>("close", {mediaState});
}

const prepare = (e:Mp.OnReady) => {
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

const load = (e:Mp.OnFileLoad) => {

    currentFile = e.currentFile;

    if(currentFile.id){
        loadMedia(e.autoPlay)
    }else{
        initPlayer();
    }

}

window.api.receive<Mp.OnReady>("ready", prepare)
window.api.receive<Mp.OnFileLoad>("on-file-load", load)
window.api.receive("toggle-play", togglePlay)
window.api.receive<Mp.ConfigChanged>("change-display-mode", onChangeDisplayMode)
window.api.receive("reset", initPlayer)
window.api.receive<Mp.ReleaseFileRequest>("release-file", beforeDelete)
window.api.receive<Mp.ConfigChanged>("after-toggle-maximize", onWindowSizeChanged)
window.api.receive("toggle-convert", () => toggleConvert())
window.api.receive<Mp.ChangePlaySpeedRequest>("change-playback-rate", changePlaybackRate)
window.api.receive<Mp.ChangePlaySpeedRequest>("change-seek-speed", changeSeekSpeed);
window.api.receive<Mp.ReplaceFileRequest>("replace-file", replaceMedia)
window.api.receive<Mp.Logging>("log", data => console.log(data.log))

window.addEventListener("load", () => {
    Dom.title = document.getElementById("title");
    Dom.resizeBtn = document.getElementById("resizeBtn")
    Dom.viewport = document.getElementById("viewport");
    Dom.video = document.getElementById("video") as HTMLVideoElement
    Dom.container = document.getElementById("container");
    Dom.buttons = document.getElementById("buttons")
    Dom.currentTimeArea = document.getElementById("videoCurrentTime")
    Dom.durationArea = document.getElementById("videoDuration")
    Dom.ampArea = document.getElementById("ampArea")
    Dom.setting = document.getElementById("setting")
    Dom.convertState = document.getElementById("convertState")

    containerRect = Dom.container.getBoundingClientRect();

    Dom.video.addEventListener("canplaythrough", onMediaLoaded)

    Dom.video.addEventListener("ended", () => changeFile(FORWARD))

    Dom.video.addEventListener("timeupdate", onTimeUpdate)

    Dom.video.addEventListener("play", onPlayed)

    Dom.video.addEventListener("pause", onPaused);

    Dom.container.addEventListener("dragover", e => e.preventDefault())

    Dom.container.addEventListener("drop",  onFileDrop);

    prepareSliders();

});

window.addEventListener("keydown", onKeydown)
window.addEventListener("resize", onResize)
window.addEventListener("contextmenu", onContextMenu)

document.addEventListener("click", onClick)
document.addEventListener("dblclick", onDblClick)
document.addEventListener("mousedown", onMousedown)
document.addEventListener("mousemove", moveSlider)
document.addEventListener("mouseup", onMouseup)

export {};