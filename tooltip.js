let tooltip;
window.onload = function(){
    tooltip = document.getElementById("tooltip")
    tooltip.addEventListener("mouseenter", e => window.api.send("hide-tooltip"))
}

window.api.receive("change-content", data => {
    tooltip.textContent = data.content;
    if(data.content){
        const rect = tooltip.getBoundingClientRect();
        window.api.send("content-set", {width:rect.width, height:rect.height, y:data.position.y + rect.top, x: data.position.x + rect.left})
    }
})