import { DomElement } from "../dom"
import { audioExtentions } from "../../constants";

const Dom = {
    viewport: new DomElement("viewport"),
    srcFileInput: new DomElement<HTMLInputElement>("sourceFile"),
    srcFileSelectBtn: new DomElement("sourceFileSelection"),
    videoRadio: new DomElement<HTMLInputElement>("video"),
    audioRadio: new DomElement<HTMLInputElement>("audio"),
    maxVolumeCheckbox: new DomElement<HTMLInputElement>("MaxVolume"),
    volumeInput: new DomElement<HTMLInputElement>("volume"),
    volumeLabel: new DomElement("volumeLabel"),
    convertBtn: new DomElement<HTMLButtonElement>("convertBtn"),
    cancelBtn: new DomElement<HTMLButtonElement>("cancelBtn"),
    message: new DomElement("message"),
}

let convertFormat:Mp.ConvertFormat = "MP4";
let frameSize:Mp.VideoFrameSize = "SizeNone";
let audioBitrate:Mp.AudioBitrate = "BitrateNone"
let rotation:Mp.VideoRotation = "RotationNone"
let audioVolume = "1";
let maxVolume = false;
let converting = false;

const onMaxVolumeChange = (e:Event) => {
    maxVolume = (e.target as HTMLInputElement).checked;
    if(maxVolume){
        Dom.volumeInput.element.disabled = true;
    }else{
        Dom.volumeInput.element.disabled = false;
    }
}

const onVolumeChange = (e:Event) => {
    audioVolume = (e.target as HTMLInputElement).value
    Dom.volumeLabel.element.textContent = `${parseFloat(audioVolume) * 100}%`
}

const onOpen = (data:Mp.OpenConvertDialogEvent) => {
    if(!converting){
        setFile(data.file)
    }
}

const closeDialog = () => {
    window.api.send("close-convert", {})
}

const setFile = (file:Mp.MediaFile) => {
    Dom.srcFileInput.element.value = file.fullPath
    changeFormat(audioExtentions.includes(file.extension) ? "MP3" : "MP4")
    toggleFormatOption(file);
}

const changeFormat = (format:Mp.ConvertFormat) => {

    Dom.viewport.element.classList.remove("audio", "video")

    convertFormat = format;

    if(convertFormat === "MP3"){
        Dom.viewport.element.classList.add("audio")
        Dom.audioRadio.element.checked = true;
        Dom.videoRadio.element.checked = false;
    }else{
        Dom.viewport.element.classList.add("video")
        Dom.audioRadio.element.checked = false;
        Dom.videoRadio.element.checked = true;
    }
}

const toggleFormatOption = (file:Mp.MediaFile) => {
    if(audioExtentions.includes(file.extension)){
        Dom.videoRadio.element.disabled = true;
    }else{
        Dom.videoRadio.element.disabled = false;
    }
}

const lock = () => {
    converting = true;
    document.querySelectorAll("input").forEach(element => element.disabled = true)
    Dom.cancelBtn.element.disabled = false;
    Dom.convertBtn.element.disabled = true;
}

const unlock = () => {
    converting = false;
    document.querySelectorAll("input").forEach(element => element.disabled = false)
    Dom.cancelBtn.element.disabled = true;
    Dom.convertBtn.element.disabled = false;
}

const requestConvert = () => {

    lock();

    Dom.message.element.textContent = ""

    const args:Mp.ConvertRequest = {
        sourcePath:Dom.srcFileInput.element.value,
        convertFormat,
        options: {
            frameSize,
            audioBitrate,
            rotation,
            audioVolume,
            maxAudioVolume:maxVolume
        }
    }

    window.api.send("request-convert", args)
}

const requestCancelConvert = () => {
    window.api.send("request-cancel-convert", {})
}

const onAfterConvert = (data:Mp.ConvertResult) => {

    unlock();

    if(data.success){
        Dom.message.element.textContent = "Done"
    }else{
        Dom.message.element.textContent = `Error - ${data.message}`
    }
}

const onSourceFileSelect = (data:Mp.FileSelectResult) => {
    setFile(data.file)
}

const applyTheme = (theme:Mp.Theme) => {
    if(theme === "light"){
        document.documentElement.removeAttribute("dark")
        document.documentElement.setAttribute("light", "");
    }else{
        document.documentElement.removeAttribute("light")
        document.documentElement.setAttribute("dark", "");
    }
}

const onThemeChange = (e:Mp.ConfigChangeEvent) => {
    applyTheme(e.config.theme)
}

const prepare = (e:Mp.ReadyEvent) => {
    console.log("sdf")
    applyTheme(e.config.theme)
}

window.api.receive("ready", prepare);
window.api.receive("change-theme", onThemeChange)
window.api.receive("open-convert", onOpen)
window.api.receive("after-convert", onAfterConvert)
window.api.receive("after-sourcefile-select", onSourceFileSelect)

window.onload = () => {
    Dom.viewport.fill();
    Dom.srcFileInput.fill();
    Dom.srcFileSelectBtn.fill();
    Dom.videoRadio.fill();
    Dom.audioRadio.fill();
    Dom.maxVolumeCheckbox.fill();
    Dom.volumeInput.fill();
    Dom.volumeLabel.fill();
    Dom.convertBtn.fill();
    Dom.cancelBtn.fill();
    Dom.message.fill();

    Dom.maxVolumeCheckbox.element.addEventListener("change", onMaxVolumeChange)
    Dom.volumeInput.element.addEventListener("input", onVolumeChange)

    Dom.cancelBtn.element.disabled = true;
    Dom.convertBtn.element.disabled = false;
}

window.addEventListener("keydown", e => {

    if(e.key === "Escape"){
        window.api.send("close-convert", {})
    }

})

document.addEventListener("click", e => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.id === "sourceFileSelection"){
        window.api.send("open-convert-sourcefile-dialog", {fullPath:Dom.srcFileInput.element.value})
    }

    if(e.target.id === "closeConvertBtn" || e.target.id == "closeBtn"){
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

    if(e.target.name === "format"){
        changeFormat(e.target.getAttribute("data-format") as Mp.ConvertFormat);
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

export {}