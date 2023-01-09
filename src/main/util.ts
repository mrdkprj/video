import fs from "fs/promises"
import path from "path";

export default class Util{

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
}
