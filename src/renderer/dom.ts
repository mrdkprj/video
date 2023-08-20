
export class DomElement<T extends HTMLElement | HTMLVideoElement | HTMLInputElement | HTMLButtonElement = HTMLElement>{

    private id:string;
    element:T;

    constructor(id:string){
        this.id = id;
    }

    fill(){
        this.element = document.getElementById(this.id) as T;
        if(!this.element) throw new Error(`Failed to get`);
        return this.element;
    }

}
