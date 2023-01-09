let tooltip:HTMLElement;

window.onload = function(){
    tooltip = document.getElementById("tooltip")
    tooltip.addEventListener("mouseenter", () => window.api.send("hide-tooltip"))
}

window.api.receive<Mp.PrepareTooltipRequest>("prepare-tooltip", (data:Mp.PrepareTooltipRequest) => {
    tooltip.textContent = data.fileName;
    if(data.fileName){
        const rect = tooltip.getBoundingClientRect();
        const args = {
            width:rect.width,
            height:rect.height,
            position: {
                y:data.position.y + rect.top,
                x: data.position.x + rect.left
            }
        }
        window.api.send<Mp.ShowTooltipRequest>("show-tooltip", args)
    }
})