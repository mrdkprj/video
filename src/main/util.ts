import fs from "fs"
import path from "path";
import crypto from "crypto"
import ffmpeg from "fluent-ffmpeg"
import { resolutions, rotations } from "../constants";

export const EmptyFile:Mp.MediaFile = {
    id:"",
    fullPath:"",
    src:"",
    name:"",
    date: 0
}

export default class Util{

    private convertDestFile:string;
    private command:ffmpeg.FfmpegCommand;

    constructor(){
        this.convertDestFile = null;
        this.command = null;
        const isDev = process.env.NODE_ENV === "development";
        const resourcePath = isDev ? path.join(__dirname, "..", "..", "resources") : path.join(process.resourcesPath, "resources")
        const ffmpegPath = path.join(resourcePath, "ffmpeg.exe")
        const ffprobePath = path.join(resourcePath, "ffprobe.exe")
        ffmpeg.setFfmpegPath(ffmpegPath)
        ffmpeg.setFfprobePath(ffprobePath)
    }

    extractFilesFromArgv(target?:string[]){

        if(target){
            return target.slice(1, target.length)
        }

        if(process.argv[1] == ".") return [];

        return process.argv.slice(1, process.argv.length)

    }

    exists(target:string, createIfNotFound = false){

        if(!target) return false;

        const result = fs.existsSync(target)

        if(result == false && createIfNotFound){
            fs.mkdirSync(target);
        }

        return result;

    }

    toFile(fullPath:string):Mp.MediaFile{

        const statInfo = fs.statSync(fullPath);

        const encodedPath = path.join(path.dirname(fullPath), encodeURIComponent(path.basename(fullPath)))

        return {
            id: crypto.randomUUID(),
            fullPath,
            src:`app://${encodedPath}`,
            name:decodeURIComponent(encodeURIComponent(path.basename(fullPath))),
            date:statInfo.mtimeMs
        }
    }

    updateFile(fullPath:string, currentFile:Mp.MediaFile):Mp.MediaFile{

        const encodedPath = path.join(path.dirname(fullPath), encodeURIComponent(path.basename(fullPath)))

        return {
            id: currentFile.id,
            fullPath,
            src:`app://${encodedPath}`,
            name:decodeURIComponent(encodeURIComponent(path.basename(fullPath))),
            date:currentFile.date,
        }
    }

    shuffle(targets:any[]){

        const result = [];
        let size = 0;
        let randomIndex = 0;

        while (targets.length > 0) {
            size = targets.length;
            randomIndex = Math.floor(Math.random() * size);

            result.push(targets[randomIndex]);
            targets.splice(randomIndex, 1);
        }

        return result;
    }

    sort(files:Mp.MediaFile[], sortType:Mp.SortType){

        if(!files.length) return;

        switch(sortType){
            case "NameAsc":
                files.sort((a,b) => a.name.replace(path.extname(a.name), "").localeCompare(b.name.replace(path.extname(b.name), "")))
                break;
            case "NameDesc":
                files.sort((a,b) => b.name.replace(path.extname(b.name), "").localeCompare(a.name.replace(path.extname(a.name), "")))
                break;
            case "DateAsc":
                files.sort((a,b) => a.date - b.date)
                break;
            case "DateDesc":
                files.sort((a,b) => b.date - a.date)
                break;
        }

    }

    getMediaDetail(fullPath:string):Promise<ffmpeg.FfprobeData>{

        return new Promise((resolve,reject)=>{
            ffmpeg.ffprobe(fullPath, (error:any, metadata:ffmpeg.FfprobeData) => {

                if(error){
                    reject(new Error("Read media metadata failed"))
                }

                resolve(metadata);
            })
        })
    }

    cancelConvert(){
        if(this.command){
            this.command.kill("SIGKILL");
        }
    }

    async getMaxVolume(sourcePath:string):Promise<string>{
        return new Promise((resolve,reject)=>{

            this.command = ffmpeg({source:sourcePath})

            this.command.outputOptions([
                "-vn",
                "-af",
                "volumedetect",
                "-f null",
            ]).on("error", async (err:any) => {
                reject(new Error(err.message))
            })
            .on("end", (stdout, stderr) => {
                this.finishConvert();
                const data = stderr.match(/max_volume:\s?([^ ]*)\s?dB/)
                if(data && data.length > 1){
                    resolve(data[1])
                }
                reject(new Error("Cannot get volume"))
            })
            .saveToFile('-');

        })
    }

    async extractAudio(sourcePath:string, destPath:string, options:Mp.ConvertOptions){

        if(this.command) throw new Error("Process busy")

        this.convertDestFile = destPath;

        const metadata = await this.getMediaDetail(sourcePath);

        const audioBitrate = options.audioBitrate !== "BitrateNone" ? options.audioBitrate : Math.ceil(parseInt(metadata.streams[1].bit_rate)/1000)
        const audioVolume = options.audioVolume !== "1" ? `volume=${options.audioVolume}` : ""

        return new Promise((resolve,reject)=>{

            this.command = ffmpeg({source:sourcePath})

            this.command.format("mp3").audioCodec("libmp3lame").audioBitrate(audioBitrate)

            if(audioVolume){
                this.command.audioFilters(audioVolume)
            }

            this.command.on("error", async (err:any) => {
                    this.cleanUp();
                    reject(new Error(err.message))
                })
                .on("end", () => {
                    this.finishConvert();
                    resolve(undefined)
                })
                .save(destPath);

        })

    }

    async convertVideo(sourcePath:string, destPath:string, options:Mp.ConvertOptions){

        if(this.command) throw new Error("Process busy")

        this.convertDestFile = destPath;

        const metadata = await this.getMediaDetail(sourcePath);

        const size = resolutions[options.frameSize] ? resolutions[options.frameSize] : await this.getSize(metadata)
        const rotation = rotations[options.rotation] ? `transpose=${rotations[options.rotation]}` : "";
        const audioBitrate = options.audioBitrate !== "BitrateNone" ? options.audioBitrate : Math.ceil(parseInt(metadata.streams[1].bit_rate)/1000)
        let audioVolume = options.audioVolume !== "1" ? `volume=${options.audioVolume}` : ""

        if(options.maxAudioVolume){
            const maxVolumeText = await this.getMaxVolume(sourcePath);
            const maxVolume = parseFloat(maxVolumeText);
            if(maxVolume >= 0){
                throw new Error("No max_volume")
            }
            audioVolume = `volume=${maxVolume * -1}dB`
        }

        return new Promise((resolve,reject)=>{

            this.command = ffmpeg({source:sourcePath})

            this.command.format("mp4").videoCodec("libx264").size(size)
            if(rotation){
                this.command.withVideoFilter(rotation)
            }
            this.command.audioCodec("libmp3lame").audioBitrate(audioBitrate)
            if(audioVolume){
                this.command.audioFilters(audioVolume)
            }
            this.command.on("error", async (err:any) => {
                    this.cleanUp();
                    reject(new Error(err.message))
                })
                .on("end", () => {
                    this.finishConvert();
                    resolve(undefined)
                })
                .save(destPath);

        })
    }

    private async getSize(metadata:ffmpeg.FfprobeData){

        const rotation = metadata.streams[0].rotation

        if(rotation === "-90" || rotation === "90"){
            return `${metadata.streams[0].height}x${metadata.streams[0].width}`
        }

        return `${metadata.streams[0].width}x${metadata.streams[0].height}`
    }

    private finishConvert(){
        this.command = null;
        this.convertDestFile = null;
    }

    private cleanUp(){

        const shouldDelete = this.exists(this.convertDestFile)

        if(shouldDelete){
            fs.rmSync(this.convertDestFile);
        }

        this.finishConvert();

    }
}
