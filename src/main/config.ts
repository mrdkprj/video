import fs from "fs/promises"
import path from "path";
import Util from "./util";

const CONFIG_FILE_NAME = "mediaplayer.config.json"
const DEFAULT_CONFIG :Mp.Config = {
    volume: 1,
    ampLevel: 0.07,
    mute:false,
    fitToWindow: true,
    bounds: {width:1200, height:800, x:0, y:0},
    playlistBounds: {width:400, height:700, x:0, y:0},
    isMaximized: false,
    playlistVisible:true,
}

export default class Config{

    data:Mp.Config;

    private _file:string;
    private _directory:string;
    private _util = new Util();

    constructor(workingDirectory:string){
        this.data = DEFAULT_CONFIG;
        this._directory = process.env.NODE_ENV === "development" ? path.join(__dirname, "..", "..", "temp") : path.join(workingDirectory, "temp");
        this._file = path.join(this._directory, CONFIG_FILE_NAME)
    }

    async init(){

        await this._util.exists(this._directory, true);

        const fileExists = await this._util.exists(this._file, false);

        if(fileExists){

            const rawData = await fs.readFile(this._file, {encoding:"utf8"});
            this.data = this.createConfig(JSON.parse(rawData))

        }else{

            await this.save()

        }
    }

    createConfig(rawConfig:any):Mp.Config{

        Object.keys(rawConfig).forEach(key => {
            if(!(key as keyof Mp.Config in DEFAULT_CONFIG)){
                delete rawConfig[key]
            }
        })

        Object.keys(DEFAULT_CONFIG).forEach(key => {
            if(!(key in rawConfig)){
                rawConfig[key] = DEFAULT_CONFIG[key as keyof Mp.Config];
            }
        })

        return rawConfig;
    }

    async save(){
        await fs.writeFile(this._file, JSON.stringify(this.data));
    }

}


