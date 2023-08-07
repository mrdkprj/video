const Dom = {
    viewport:null as HTMLElement,
    srcFileInput:null as HTMLInputElement,
    srcFileSelectBtn:null as HTMLElement,
    maxVolumeCheckbox:null as HTMLInputElement,
    volumeInput:null as HTMLInputElement,
    convertBtn:null as HTMLButtonElement,
    cancelBtn:null as HTMLButtonElement,
    message:null as HTMLElement,
}

let convertType = "video";
let frameSize:Mp.VideoFrameSize = "SizeNone";
let audioBitrate:Mp.AudioBitrate = "BitrateNone"
let rotation:Mp.VideoRotation = "RotationNone"
let audioVolume = "1";
let maxVolume = false;
let converting = false;

const onMaxVolumeChange = (e:Event) => {
    maxVolume = (e.target as HTMLInputElement).checked;
    if(maxVolume){
        Dom.volumeInput.disabled = true;
    }else{
        Dom.volumeInput.disabled = false;
    }
}

const onVolumeChange = (e:Event) => {
    audioVolume = (e.target as HTMLInputElement).value
    document.getElementById("volumeLabel").textContent = `${parseFloat(audioVolume) * 100}%`
}

window.onload = () => {
    Dom.viewport = document.getElementById("viewport");
    Dom.srcFileInput = document.getElementById("sourceFile") as HTMLInputElement
    Dom.srcFileSelectBtn = document.getElementById("sourceFileSelection")
    Dom.maxVolumeCheckbox = document.getElementById("MaxVolume") as HTMLInputElement
    Dom.volumeInput = document.getElementById("volume") as HTMLInputElement
    Dom.convertBtn = document.getElementById("convertBtn") as HTMLButtonElement
    Dom.cancelBtn = document.getElementById("cancelBtn") as HTMLButtonElement
    Dom.message = document.getElementById("message")

    Dom.maxVolumeCheckbox.addEventListener("change", onMaxVolumeChange)
    Dom.volumeInput.addEventListener("input", onVolumeChange)

    Dom.cancelBtn.disabled = true;
    Dom.convertBtn.disabled = false;
}

window.addEventListener("keydown", e => {

    if(e.key === "Escape"){
        window.api.send("close-convert")
    }

})

document.addEventListener("click", e => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.id === "sourceFileSelection"){
        window.api.send("open-convert-sourcefile-dialog")
    }

    if(e.target.id === "closeConvertBtn"){
        closeDialog();
    }

    if(e.target.id === "convertBtn"){
        requestConvert();
    }

    if(e.target.id === "cancelBtn"){
        requestCancelConvert();
    }

})

document.addEventListener("change", e => {

    if(!e.target || !(e.target instanceof HTMLInputElement)) return;

    if(e.target.name === "type"){
        convertType = e.target.id;
        changeType();
    }

    if(e.target.name === "spec"){
        frameSize = e.target.id as Mp.VideoFrameSize;
    }

    if(e.target.name === "audioBitrate"){
        audioBitrate = e.target.id as Mp.AudioBitrate;
    }

    if(e.target.name === "rotation"){
        rotation = e.target.id as Mp.VideoRotation
    }
})

const onOpen = (data:Mp.MediaFile) => {

    if(!converting){
        Dom.srcFileInput.value = data.fullPath
    }

}

const closeDialog = () => {
    window.api.send("close-convert")
}

const changeType = () => {
    if(convertType === "video"){
        Dom.viewport.classList.add("video")
    }else{
        Dom.viewport.classList.remove("video")
    }
}

const lock = () => {
    converting = true;
    document.querySelectorAll("input").forEach(element => element.disabled = true)
    Dom.cancelBtn.disabled = false;
    Dom.convertBtn.disabled = true;
}

const unlock = () => {
    converting = false;
    document.querySelectorAll("input").forEach(element => element.disabled = false)
    Dom.cancelBtn.disabled = true;
    Dom.convertBtn.disabled = false;
}

const requestConvert = () => {

    lock();

    Dom.message.textContent = ""

    const args:Mp.ConvertRequest = {
        sourcePath:Dom.srcFileInput.value,
        video:convertType === "video",
        options: {
            frameSize,
            audioBitrate,
            rotation,
            audioVolume,
            maxAudioVolume:maxVolume
        }
    }

    window.api.send<Mp.ConvertRequest>("request-convert", args)
}

const requestCancelConvert = () => {
    window.api.send("request-cancel-convert")
}

const onAfterConvert = (data:Mp.ConvertResult) => {

    unlock();

    if(data.success){
        Dom.message.textContent = "Done"
    }else{
        Dom.message.textContent = `Error - ${data.message}`
    }
}

window.api.receive<Mp.MediaFile>("before-open", (data:Mp.MediaFile) => onOpen(data))
window.api.receive<Mp.ConvertResult>("after-convert", (data:Mp.ConvertResult) => onAfterConvert(data))
window.api.receive<Mp.FileSelectResult>("after-sourcefile-select", (data:Mp.FileSelectResult) => Dom.srcFileInput.value = data.fullPath)

export {}