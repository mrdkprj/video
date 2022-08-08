let title;
let resizeBtn;
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
    callback:updateVolume
}
const ampSlider = {
    slider:null,
    track:null,
    thumb:null,
    rect:null,
    callback:updateAmpLevel
}
const sliders = {
    time: timeSlider,
    volume: volumeSlider,
    amp: ampSlider,
}

let containerRect;

let isMaximized = false;
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
    volumeSlider.thumb = document.getElementById("volumeThumb")
    ampSlider.slider = document.getElementById("amp");
    ampSlider.track = document.getElementById("ampTrack");
    ampSlider.thumb = document.getElementById("ampThumb")

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

        const duration = videoDuration > 0 ? videoDuration : 1
        const progress = (video.currentTime / duration) * 100;

        timeSlider.track.style.width = progress + "%"
        timeSlider.thumb.style.left  = progress + "%"
        currentTimeArea.textContent = formatTime(video.currentTime);

        window.api.send("progress", {progress:video.currentTime / duration})
    })

    video.addEventListener("play", e =>{
        onPlayed();
    })

    video.addEventListener("pause", e => {
        onPaused();
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

    if(e.key === "ArrowRight") playFoward({button: 0});

    if(e.key === "ArrowLeft") playBackward({button: 0});
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

const moveSlider = (e) => {

    if(!slideState.sliding) return;

    const progress = (e.pageX - slideState.slider.rect.left - THUMB_RADIUS) / slideState.slider.rect.width

    if(progress > 1 || progress < 0) return;

    slideState.slider.callback(progress)

}

function updateTime(progress){
    video.currentTime = videoDuration * progress;
}

function updateVolume(progress){
    video.volume = progress
    videoVolume = video.volume;
    const value = videoVolume * 100 + "%";
    volumeSlider.track.style.width = value;
    volumeSlider.thumb.style.left = value;
    volumeSlider.thumb.title = value;
}

function updateAmpLevel(progress){
    ampLevel = progress;
    const value = ampLevel * 100 + "%";
    ampSlider.track.style.width = value;
    ampSlider.thumb.style.left = value;
    ampSlider.thumb.title = value;
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
    videoDuration = 0;
    durationArea.textContent = formatTime(videoDuration);
    currentTimeArea.textContent = formatTime(0);
    current = null;
    buttons.classList.remove("playing")
    video.load();
}

function loadVideo(autoplay){
    source.src = current.path
    const doAuthplay = autoplay ? autoplay : !video.paused
    video.autoplay = doAuthplay;
    video.load();
}

function onVideoLoaded(){

    title.textContent = current.name
    changeVideoSize();

    videoDuration = video.duration;

    durationArea.textContent = formatTime(videoDuration);
    currentTimeArea.textContent = formatTime(video.currentTime);

    video.autoplay = false;
}

function changeVideoSize(){
    const ratio = Math.min(containerRect.width / video.videoWidth, containerRect.height / video.videoHeight);
    video.style.width = `${video.videoWidth * ratio}px`
    video.style.height = `${video.videoHeight * ratio}px`
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
        changeIndex(FORWARD)
    }

    if(video.duration < nextTime){
        changeIndex(BACKWARD)
    }

    video.currentTime = nextTime;

}

const changeIndex = index => {
    return window.api.send("changeIndex", {index})
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
    window.api.send("toggle-thumb")
    buttons.classList.add("playing")
}

function onPaused(){
    window.api.send("toggle-thumb")
    buttons.classList.remove("playing")
}

function stop(){

    if(!current) return;

    buttons.classList.remove("playing")
    video.load();
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
    window.api.send("toggleMaximize")
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
}

function load(data){

    current = data.current;

    if(current){
        loadVideo(data.play)
    }else{
        initPlayer();
    }
}

window.api.receive("config", data => {
    prepare(data.config);
})
window.api.receive("play", data => {
    load(data);
})

window.api.receive("toggle-play", data => {
    togglePlay();
})

window.api.receive("error", data => {
    alert(data.message)
})

window.api.receive("clear-current", data => {
    initPlayer();
})

window.api.receive("log", data => {
    console.log(data)
})