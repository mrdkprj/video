/*
type Size = {
    width:number;
    height:number;
}

const menuTypeName:{[key:string]:Mp.MenuType} = {
    checkbox:"checkbox",
    radio:"radio",
    text:"text",
}

const menuItemHeight = 39;
const separatorHeight = 1;

export class ContextMenu{

    options:Mp.ContextMenu[];
    menu:HTMLElement;

    private size = {
        innerHeight:0,
        outerHeight:0,
        innerWidth:0,
        outerWidth:0
    };
    private submenuSize:{[key:string]:Size} = {};
    private complete = false;
    private handler:(e:Mp.ContextMenuItem) => void;

    constructor(options?:Mp.ContextMenu[]){
        window.addEventListener("contextmenu", this.popup)
        if(options){
            this.build(this.options)
        }
    }

    popup = (e:MouseEvent) => {

        if(!this.menu) return;

        this.complete = false;
        this.menu.style.display = "flex"
        this.menu.classList.remove("revert")

        if(e.clientY + this.size.outerHeight <= document.documentElement.clientHeight){
            this.menu.style.top = `${e.clientY}px`
        }else{
            this.menu.style.top = `${e.clientY - this.size.innerHeight}px`
        }
console.log(e.clientX + this.size.outerWidth)
console.log(document.documentElement.clientWidth)
        if(e.clientX + this.size.outerWidth <= document.documentElement.clientWidth){
            this.menu.style.left = `${e.clientX}px`
        }else{
            this.menu.classList.add("revert")
            this.menu.style.left = `${e.clientX - this.size.innerWidth}px`
        }

        this.menu.focus();
        this.menu.addEventListener("blur", this.hide)
    }

    hide = () => {

        if(!this.menu) return;

        this.menu.style.display = "none"
        this.menu.removeEventListener("blur", this.hide)

    }

    build(options:Mp.ContextMenu[]){

        this.options = options;

        this.menu = document.createElement("div");
        this.menu.classList.add("menu-container")
        this.menu.setAttribute("menu", "")
        this.menu.tabIndex = 0;
        this.menu.style.top = "0px";
        this.menu.style.left = "0px";
        this.menu.style.visibility = "hidden"

        this.options.forEach(menuItem => this.menu.append(this.createMenu(menuItem)))

        document.body.append(this.menu)

        this.setSize();

        this.menu.style.visibility = ""
        this.menu.style.display = "none"

    }

    private setSize = () => {
        const menuRect = this.menu.getBoundingClientRect()
        this.size.innerHeight = menuRect.height;
        this.size.innerWidth = menuRect.width;
        this.size.outerHeight = menuRect.height
        this.size.outerWidth = menuRect.width;

        const highestChild = Object.keys(this.submenuSize).reduce((a, b) => this.submenuSize[a].height > this.submenuSize[b].height ? a : b);
        const highestSubmenu = this.menu.querySelector(`#${highestChild}`)?.querySelector(".submenu")

        if(highestSubmenu){
            const submenuRect = highestSubmenu.getBoundingClientRect();
            this.size.outerHeight = submenuRect.bottom - menuRect.top;
        }

        const widestChild = Object.keys(this.submenuSize).reduce((a, b) => this.submenuSize[a].width > this.submenuSize[b].width ? a : b);
        const widestSubmenu = this.menu.querySelector(`#${widestChild}`)?.querySelector(".submenu")
        if(widestSubmenu){
            const submenuRect = widestSubmenu.getBoundingClientRect();
            this.size.outerWidth = submenuRect.right - menuRect.left;
        }
    }

    onClick(handler:(e:Mp.ContextMenuItem) => void){
        this.handler = handler;
    }

    private createId(){
        return "menu" + crypto.randomUUID();
    }

    private createMenu(menuItem:Mp.ContextMenu){

        if(menuItem.type == "checkbox"){
            return this.createCheckboxMenu(menuItem)
        }

        if(menuItem.type == "radio"){
            return this.createCheckboxMenu(menuItem)
        }

        if(menuItem.type == "separator"){
            return this.createSeparator()
        }

        if(menuItem.type == "submenu" && menuItem.submenu){
            return this.createSubmenu(menuItem, menuItem.submenu)
        }

        const menu = document.createElement("div");
        menu.id = this.createId()
        menu.classList.add("menu-item")
        menu.setAttribute("name", menuItem.name)
        menu.setAttribute("data-type", menuItem.type ?? menuTypeName.text)
        menu.setAttribute("data-value", menuItem.value ?? "")
        menu.textContent = menuItem.label ?? ""
        menu.addEventListener("click", this.onMenuItemClick)

        return menu
    }

    private createSubmenu(submenuItem:Mp.ContextMenu, submenuMenuItems:Mp.ContextMenu[]){

        const container = document.createElement("div");
        container.id = this.createId();
        container.classList.add("submenu-container", "menu-item")
        container.addEventListener("mouseenter", this.onSubmenuMouseEnter)

        const header = document.createElement("div")
        header.classList.add("submenu-header")
        header.textContent = submenuItem.label ?? ""
        container.append(header)

        const submenu = document.createElement("div");
        submenu.classList.add("submenu")
        submenu.setAttribute("menu", "")
        submenuMenuItems.forEach(menuItem => submenu.append(this.createMenu(menuItem)))
        container.append(submenu)

        this.submenuSize[container.id] = this.getSubmenuSize(submenuMenuItems)

        return container;

    }

    private getSubmenuSize(submenuMenuItems:Mp.ContextMenu[]){

        let height = 0;
        let width = 0;
        submenuMenuItems.forEach(item => {
            if(item.type === menuTypeName.separator){
                height += separatorHeight;
            }else{
                height += menuItemHeight
            }

            if(item.label){
                width = width > item.label.length ? item.label.length : width;
            }
        })

        return { width, height}
    }

    private onSubmenuMouseEnter = (e:MouseEvent) => {

        if(this.complete) return;

        const target = e.target as HTMLElement

        const bottom = e.clientY + this.submenuSize[target.id].height;
        const overflow = bottom - document.documentElement.clientHeight;
        const submenu = target.querySelector(".submenu") as HTMLElement;
        if(overflow > 0){
            submenu.style.top = `${-overflow}px`
        }else{
            submenu.style.top = "0px"
        }

        this.complete = true;
    }

    private createCheckboxMenu(menuItem:Mp.ContextMenu){
        const menu = document.createElement("div");
        menu.id = this.createId()
        menu.classList.add("checkbox-menu", "menu-item")
        menu.setAttribute("name", menuItem.name)
        menu.setAttribute("data-type", menuItem.type ?? menuTypeName.text)
        menu.setAttribute("data-value", menuItem.value ?? "")
        menu.textContent = menuItem.label ?? ""

        if(menuItem.checked){
            menu.setAttribute("checked", "")
        }

        menu.addEventListener("click", this.onMenuItemClick)

        return menu;
    }

    private createSeparator(){
        const separator = document.createElement("div");
        separator.classList.add("menu-separator")
        return separator;
    }

    private onMenuItemClick = (e:MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;
        const targetType = target.getAttribute("data-type");

        if(!targetType) return;

        if(targetType == menuTypeName.checkbox || targetType == menuTypeName.radio){
            this.toggleCheck(e);
        }

        if(this.handler){
            this.handler({menu:target.getAttribute("name") as Mp.ContextMenuType, value:target.getAttribute("data-value") ?? ""})
        }

        this.hide();

    }

    private toggleCheck(e:MouseEvent){

        const target = e.target as HTMLElement;

        if(target.getAttribute("data-type") == menuTypeName.radio){
            return this.toggleRadio(target);
        }

        if(target.hasAttribute("checked")){
            target.removeAttribute("checked")
        }else{
            target.setAttribute("checked", "")
        }

    }

    private toggleRadio(target:HTMLElement){

        const parent = target.parentElement

        if(!parent?.hasAttribute("menu")) return;

        Array.from(parent.children).forEach(menu => {
            if(menu.id != target.id){
                menu.removeAttribute("checked")
            }
        })

        target.setAttribute("checked", "");
    }

}
*/