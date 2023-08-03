import fs from "fs"
import path from "path";
import crypto from "crypto"
import ffmpeg from "fluent-ffmpeg"
import { resolutions, rotations } from "../constants";

export const EmptyFile:Mp.MediaFile = {
    id:"",
    uuid:"",
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
            id: encodeURIComponent(fullPath),
            uuid: crypto.randomUUID(),
            fullPath,
            src:`app://${encodedPath}`,
            name:decodeURIComponent(encodeURIComponent(path.basename(fullPath))),
            date:statInfo.mtimeMs
        }
    }

    updateFile(fullPath:string, currentFile:Mp.MediaFile):Mp.MediaFile{

        const encodedPath = path.join(path.dirname(fullPath), encodeURIComponent(path.basename(fullPath)))

        return {
            id: encodeURIComponent(fullPath),
            uuid: currentFile.uuid,
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

    sort(files:Mp.MediaFile[], sortType:SortType){

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

    async extractAudio(sourcePath:string, destPath:string, bitrate:string){

        if(this.command) throw new Error("Process busy")

        this.convertDestFile = destPath;

        return new Promise((resolve,reject)=>{

            this.command = ffmpeg({source:sourcePath})

            this.command.format("mp3")
                .audioCodec("libmp3lame")
                .audioBitrate(bitrate)
                .on("error", async (err:any) => {
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

    async convertVideo(sourcePath:string, destPath:string, frameSize:Mp.VideoFrameSize){

        if(this.command) throw new Error("Process busy")

        this.command = ffmpeg({source:sourcePath})

        const size = await this.getSize(sourcePath, frameSize)

        return new Promise((resolve,reject)=>{

            this.command.format("mp4")
                .videoCodec("libx264")
                .size(size)
                .on("error", async (err:any) => {
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

    private async getSize(sourcePath:string, frameSize:Mp.VideoFrameSize){

        const desiredSize = resolutions[frameSize];

        if(desiredSize) return desiredSize;

        const metadata = await this.getMediaDetail(sourcePath);

        const rotation = metadata.streams[0].rotation

        if(rotation === "-90" || rotation === "90"){
            return `${metadata.streams[0].height}x${metadata.streams[0].width}`
        }

        return `${metadata.streams[0].width}x${metadata.streams[0].height}`
    }

    async rotateVideo(sourcePath:string, destPath:string, ratationName:Mp.VideoRotation){

        if(this.command) throw new Error("Process busy")

        const rotation = rotations[ratationName];

        return new Promise((resolve,reject)=>{

            this.command = ffmpeg({source:sourcePath})

            this.command.format("mp4")
                .withVideoFilter(`transpose=${rotation}`)
                .on("error", async (err:any) => {
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
