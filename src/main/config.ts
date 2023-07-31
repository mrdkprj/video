import fs from "fs"
import path from "path";
import Util from "./util";
import { CONFIG_FILE_NAME, defaultConfig } from "../constants";

export default class Config{

    data:Mp.Config;

    private _file:string;
    private _directory:string;
    private _util = new Util();

    constructor(workingDirectory:string){
        this.data = defaultConfig;
        this._directory = process.env.NODE_ENV === "development" ? path.join(__dirname, "..", "..", "temp") : path.join(workingDirectory, "temp");
        this._file = path.join(this._directory, CONFIG_FILE_NAME)
    }

    init(){

        this._util.exists(this._directory, true);

        const fileExists = this._util.exists(this._file, false);

        if(fileExists){

            const rawData = fs.readFileSync(this._file, {encoding:"utf8"});
            this.data = this.createConfig(JSON.parse(rawData))

        }else{

            fs.writeFileSync(this._file, JSON.stringify(this.data));

        }
    }

    createConfig(rawConfig:any):Mp.Config{

        const config = {...defaultConfig} as any;

        Object.keys(rawConfig).forEach(key => {

            if(!(key in config)) return;

            const value = rawConfig[key];

            if(typeof value === "object"){

                Object.keys(value).forEach(valueKey => {
                    if(valueKey in config[key]){
                        config[key][valueKey] = value[valueKey]
                    }
                })
            }else{
                config[key] = value;
            }
        })

        return config;
    }

    save(mediaState:Mp.MediaState){
        this.data.audio.volume = mediaState.videoVolume;
        this.data.audio.ampLevel = mediaState.ampLevel;
        this.data.video.fitToWindow = mediaState.fitToWindow;
        this.data.audio.mute = mediaState.mute;

        fs.writeFileSync(this._file, JSON.stringify(this.data));
    }

}


