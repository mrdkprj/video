import fs from "fs/promises"
import path from "path";

export default class Util{

    extractFilesFromArgv(target?:string[]){

        if(target){
            return target.slice(1, target.length)
        }

        return process.argv.slice(1, process.argv.length)

    }

    async exists(target:string, createIfNotFound = false){

        try{
            await fs.stat(target);

            return true;

        }catch(ex){

            if(createIfNotFound){
                await fs.mkdir(target);
            }

            return false;
        }
    }

    async toFile(fullPath:string):Promise<Mp.MediaFile>{

        const statInfo = await fs.stat(fullPath);

        const encodedPath = path.join(path.dirname(fullPath), encodeURIComponent(path.basename(fullPath)))

        return {
            id:encodeURIComponent(fullPath),
            fullPath,
            src:`app://${encodedPath}`,
            name:decodeURIComponent(encodeURIComponent(path.basename(fullPath))),
            date:statInfo.mtimeMs
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
}
