let title;
let resizeBtn;
let viewport;
let video;
let source;
let container;
let currentTimeArea;
let durationArea;
let buttons;

const timeSlider = {
    slider:null,
    track:null,
    thumb:null,
    rect:null,
    callback:updateTime
}
const volumeSlider = {
    slider:null,
    track:null,
    thumb:null,
    rect:null,
    trackValue:null,
    callback:updateVolume
}
const ampSlider = {
    slider:null,
    track:null,
    thumb:null,
    rect:null,
    trackValue:null,
    callback:updateAmpLevel
}
const sliders = {
    time: timeSlider,
    volume: volumeSlider,
    amp: ampSlider,
}

let containerRect;

let isMaximized = false;
let fitToWindow = true;
let isMute = false;
let videoDuration = 0;
let videoVolume = 1;
let ampLevel = 0.07;
let gainNode;

let current;

const FORWARD = 1;
const BACKWARD = -1;
const THUMB_RADIUS = 4;
const SLIDE_MARGIN = 8;

const slideState = {
    sliding:false,
    startX:0,
    slider:null
}

window.addEventListener("load", e => {
    title = document.getElementById("title");
    resizeBtn = document.getElementById("resizeBtn")
    viewport = document.getElementById("viewport");
    video = document.getElementById("video");
    source = document.getElementById("source")
    container = document.getElementById("container");
    buttons = document.getElementById("buttons")
    currentTimeArea = document.getElementById("videoCurrentTime")
    durationArea = document.getElementById("videoDuration")

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

    containerRect = container.getBoundingClientRect();
    timeSlider.rect = timeSlider.slider.getBoundingClientRect();
    volumeSlider.rect = volumeSlider.slider.getBoundingClientRect();
    ampSlider.rect = ampSlider.slider.getBoundingClientRect();

    video.addEventListener("canplaythrough", e => {
        onVideoLoaded(e);
    })

    video.addEventListener("ended", e => {
        changeIndex(FORWARD);
    })

    video.addEventListener("timeupdate", e => {
        onTimeUpdate()
    })

    video.addEventListener("play", e =>{
        onPlayed();
    })

    video.addEventListener("pause", e => {
        if(video.currentTime !== video.duration){
            onPaused();
        }
    })

    container.addEventListener("dragover", e => {
        e.preventDefault();
    })

    container.addEventListener("drop", e =>{
        e.preventDefault();
        onFileDrop(e)
    });

});

document.addEventListener("click", (e) =>{

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

    if(e.target.classList.contains("main")){
        togglePlay()
    }

})

document.addEventListener("mousedown", e => {

    if(e.target.id == "prevBtn"){
        playBackward(e);
    }

    if(e.target.id == "nextBtn"){
        playFoward(e);
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
            playFoward({button: 0});
        }
    }

    if(e.key === "ArrowLeft"){
        if(e.shiftKey){
            changeCurrentTime(-0.5)
        }else{
            playBackward({button: 0});
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

window.addEventListener("resize", e => {
    containerRect = container.getBoundingClientRect();
    timeSlider.rect = timeSlider.slider.getBoundingClientRect();
    volumeSlider.rect = volumeSlider.slider.getBoundingClientRect();
    changeVideoSize()
})

window.addEventListener("contextmenu", e => {

    if(e.target.classList.contains("main")){
        e.preventDefault()
        window.api.send("main-context")
    }
})

function startSlide(e){
    slideState.sliding = true;
    const target = e.target.getAttribute("data-target")
    slideState.slider = sliders[target];
    slideState.startX = e.offsetX
}

function moveSlider(e){

    if(!slideState.sliding) return;

    const progress = (e.pageX - slideState.slider.rect.left - THUMB_RADIUS) / slideState.slider.rect.width

    if(progress > 1 || progress < 0) return;

    slideState.slider.callback(progress)

}

function updateTime(progress){
    video.currentTime = videoDuration * progress;
}

function onTimeUpdate(){
    const duration = videoDuration > 0 ? videoDuration : 1
    const progress = (video.currentTime / duration) * 100;

    timeSlider.track.style.width = progress + "%"
    timeSlider.thumb.style.left  = progress + "%"
    currentTimeArea.textContent = formatTime(video.currentTime);

    window.api.send("progress", {progress:video.currentTime / duration})
}

function updateVolume(progress){
    video.volume = progress
    videoVolume = video.volume;
    const value = videoVolume * 100 + "%";
    volumeSlider.track.style.width = value;
    volumeSlider.thumb.style.left = value;
    volumeSlider.thumb.title = value;
    volumeSlider.trackValue.textContent = `${parseInt(value)}%`;
}

function updateAmpLevel(progress){
    ampLevel = progress;
    const value = ampLevel * 100 + "%";
    ampSlider.track.style.width = value;
    ampSlider.thumb.style.left = value;
    ampSlider.thumb.title = value;
    ampSlider.trackValue.textContent = `${parseInt(value)}%`;
    gainNode.gain.value = ampLevel * 10;
}

function onFileDrop(e){

    const dropFiles = Array.from(e.dataTransfer.items).filter(item => {
        return item.kind === "file" && (item.type.includes("video") || item.type.includes("audio"));
    })

    if(dropFiles.length > 0){
        window.api.send("drop", {files:dropFiles.map(item => item.getAsFile().path), playlist:false})
    }
}

function formatTime(secondValue){
    const hours = (Math.floor(secondValue / 3600)).toString().padStart(2, "0");
    const minutes = (Math.floor(secondValue % 3600 / 60)).toString().padStart(2, "0");
    const seconds = (Math.floor(secondValue % 3600 % 60)).toString().padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
}

function initPlayer(){
    source.src = "";
    title.textContent = "";
    document.title = "VidPlayer";
    videoDuration = 0;
    durationArea.textContent = formatTime(videoDuration);
    currentTimeArea.textContent = formatTime(0);
    current = null;
    viewport.classList.remove("loaded");
    buttons.classList.remove("playing")
    video.load();
}

function releaseFile(){
    source.src = "";
    video.load();
}

function loadVideo(autoplay){
    source.src = current.src
    const doAuthplay = autoplay ? autoplay : buttons.classList.contains("playing")
    video.autoplay = doAuthplay;
    video.muted = isMute;
    video.load();
}

function onVideoLoaded(){

    document.title = `VidPlayer - ${current.name}`
    title.textContent = current.name
    changeVideoSize();

    videoDuration = video.duration;

    durationArea.textContent = formatTime(videoDuration);
    currentTimeArea.textContent = formatTime(video.currentTime);

    viewport.classList.add("loaded");

    video.autoplay = false;
}

function changeVideoSize(){

    if(fitToWindow){
        const ratio = Math.min(containerRect.width / video.videoWidth, containerRect.height / video.videoHeight);
        video.style.width = `${video.videoWidth * ratio}px`
        video.style.height = `${video.videoHeight * ratio}px`
    }else{
        video.style.width = ""
        video.style.height = ""
    }
}

function amplify(){

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(video);

    gainNode = audioCtx.createGain();
    updateAmpLevel(ampLevel);
    source.connect(gainNode);

    gainNode.connect(audioCtx.destination);

}

function playFoward(e){

    if(!current) return;

    if(e.button === 0){
        changeCurrentTime(10);
    }

    if(e.button === 2){
        changeIndex(FORWARD)
    }
}

function playBackward(e){

    if(!current) return;

    if(e.button === 0){
        changeCurrentTime(-10)
    }

    if(e.button === 2){
        changeIndex(BACKWARD)
    }
}

function changeCurrentTime(time){

    const nextTime = video.currentTime + time;

    if(nextTime >= video.duration){
        return changeIndex(FORWARD)
    }

    if(nextTime < 0){
        return changeIndex(BACKWARD)
    }

    video.currentTime = nextTime;

}

function changeIndex(index){
    return window.api.send("change-index", {index})
}

function togglePlay(){

    if(!current) return;

    if(video.paused){
        video.play();
    }else{
        video.pause();
    }
}

function onPlayed(){
    window.api.send("played")
    buttons.classList.add("playing")
}

function onPaused(){
    window.api.send("paused")
    buttons.classList.remove("playing")
}

function stop(){

    if(!current) return;

    window.api.send("paused")
    buttons.classList.remove("playing")
    video.load();
}

function saveImage(){
    const canvas = document.createElement("canvas");
    const width = parseInt(video.style.width.replace("px"));
    const height = parseInt(video.style.height.replace("px"));
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);
    const image = canvas.toDataURL("image/jpeg").replace(/^data:image\/jpeg;base64,/, "");

    window.api.send("save-image", {data:image, timestamp:video.currentTime})
}

function toggleMute(){
    isMute = !isMute;
    video.muted = isMute;
    if(isMute){
        buttons.classList.add("mute")
    }else{
        buttons.classList.remove("mute")
    }
}

function changeMaximizeIcon(){
    if(isMaximized){
        resizeBtn.classList.remove("minbtn");
        resizeBtn.classList.add("maxbtn");
    }else{
        resizeBtn.classList.remove("maxbtn");
        resizeBtn.classList.add("minbtn");
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

function close(){
    const config = {volume:videoVolume, ampLevel}
    window.api.send("close", config);
}

function prepare(config){
    isMaximized = config.bounds.isMaximized;
    changeMaximizeIcon();

    videoVolume = config.volume;
    updateVolume(videoVolume);

    ampLevel = config.ampLevel;
    amplify();

    fitToWindow = config.fitToWindow;
}

function load(data){

    current = data.current;

    if(current){
        loadVideo(data.play)
    }else{
        initPlayer();
    }
}

window.api.receive("config", data => prepare(data.config))

window.api.receive("play", data => load(data))

window.api.receive("toggle-play", data => togglePlay())

window.api.receive("change-size-mode", data => {
    fitToWindow = data.fitToWindow;
    changeVideoSize();
})

window.api.receive("reset", data => initPlayer())

window.api.receive("error", data => alert(data.message))

window.api.receive("release-file", data => releaseFile())

window.api.receive("log", data => console.log(data))
