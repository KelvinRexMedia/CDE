var Collision = window.CDE.Collision;
var Settings = window.CDE.Settings;
var EventSystem = window.CDE.EventSystem;
var Cursor = window.CDE.Cursor;
var Color = window.CDE.Color;
var Grid = window.CDE.Grid;
var Renderer = window.CDE.Renderer;
var DrawingTool = window.CDE.DrawingTool;
var SelectorTool = window.CDE.SelectorTool;
var GeneratorTool = window.CDE.GeneratorTool;
var HistoryTool = window.CDE.HistoryTool;
var ContextMenu = window.CDE.ContextMenu;
var ContextMenuOption = window.CDE.ContextMenuOption;

//Core
var cursor, grid, renderer, drawingTool, selectorTool;
//Visuals
var drawingToolElem, selectorToolElem, selectorToolMenu, generatorElem, generatorMenu;
//Other
var hasSelectedShape;

function setup() {
    var canvas = createCanvas(visualViewport.width, visualViewport.height);

    HistoryTool.instance();
    Settings.setCanvas(canvas);

    renderer = new Renderer();
    cursor = new Cursor();
    grid = new Grid();
    drawingTool = new DrawingTool();
    selectorTool = new SelectorTool();
    generatorTool = new GeneratorTool();

    frameRate(60);
    Window.currentTool = null;
    hasSelectedShape = null;

    //Visuals
    drawingToolElem = document.getElementById("drawingTool");
    selectorToolElem = document.getElementById("selectorTool");
    generatorElem = document.getElementById("generatorTool");

    selectorToolMenu = new ContextMenu('selectorToolMenu', [
        new ContextMenuOption('Allowed', 'checkbox', null, null, (e) => { e.querySelector('input').checked = selectorTool.shape != null ? selectorTool.shape.isAllowed : false; }, null, (e) => {
            selectorTool.shape.isAllowed = e.target.checked; selectorTool.shape.color = selectorTool.shape.isAllowed ? Settings.shapeAllowed : Settings.shapeForbidden;selectorTool.shape.redraw(); }),
        new ContextMenuOption('Multi Tool', 'radio', null, 'toolMode', (e) => { e.querySelector('input').checked = true; updateToolMode('multiTool') }, null, (e) => { updateToolMode('multiTool');}),
        new ContextMenuOption('Move', 'radio', null, 'toolMode', null, null, (e) => { updateToolMode('move'); }),
        new ContextMenuOption('Insert', 'radio', null, 'toolMode', null, null, (e) => { updateToolMode('insert'); }),
        new ContextMenuOption('Delete', 'radio', null, 'toolMode', null, null, (e) => { updateToolMode('delete'); }),
        new ContextMenuOption('Confirm', null, 'fa-solid fa-check', null, null, (e) => { confirmSelected(); }),
        new ContextMenuOption('Delete Shape', null, 'fa-solid fa-trash', null, null, (e) => { deleteSelected(); }),
    ]);

    generatorMenu = new ContextMenu('generatorMenu', [
        new ContextMenuOption('Generate', null, 'fa-solid fa-check', null, null, (e) => { generatorTool.generate(); }),
        // new ContextMenuOption('Randafwerking (bove)', 'dropdown', null, null, null, null, null, ["None", "Alucobond", "Pannen", "Nokvorst"]),
    ]);

    //load generation settings
    updateSettings();
    generatorTool.generate();
}

function draw() {
    background(225, 225, 225);

    push();
    translate(cursor.offset.x, cursor.offset.y);
    scale(Settings.zoom);
    grid.update();
    renderer.update();
    drawingTool.update();
    selectorTool.update();
    generatorTool.update();
    pop();

    cursor.update();
    showFPS();
    // showHistory();
    updateVisuals();

    if (drawingTool.isEnabled && Window.currentTool != drawingTool) {
        Window.currentTool = drawingTool;
    }
    if (selectorTool.isEnabled && Window.currentTool != selectorTool) {
        Window.currentTool = selectorTool;
    }
}

let fr = 60;
function showFPS() {
    push();
    fr = 0.95 * fr + 0.05 * frameRate();
    fill(0);
    rect(0, 0, 40, 35);
    fill(255, 255, 255);
    noStroke();
    text(str(floor(fr * 100) / 100), 5, 16);
    text(Settings.zoom.toFixed(2) + "%", 4, 30);
    pop();
}

function showHistory() {
    push();

    fill(0);
    rect(width - 250, 0, 250, 500);

    var count = 0;
    for (let i = HistoryTool.count() - 1; i >= 0; i--) {
        if(count >= 15){break;}
        count++;
        
        var action = HistoryTool.get(i);
        var index = HistoryTool.getIndex();
        noStroke();
        if (index == i) {
            fill(0, 255, 0);
        }
        else{
            fill(255, 255, 255);
        }
        text(count + ". " + action.name, width - 250, 25 + (16 * count));
        stroke(255);
        line(width - 250, 25 + (16 * count), width, 25 + (16 * count));
    }
    pop();
}

function updateVisuals(){
    //Drawing tool
    if (drawingTool.isEnabled && !drawingToolElem.classList.contains("active")) {
        drawingToolElem.classList.add("active");
    }
    else if (!drawingTool.isEnabled && drawingToolElem.classList.contains("active")) {
        drawingToolElem.classList.remove("active");
    }

    //Selector tool
    if (selectorTool.isEnabled && !selectorToolElem.classList.contains("active")) {
        selectorToolElem.classList.add("active");
    }
    else if (!selectorTool.isEnabled && selectorToolElem.classList.contains("active")) {
        selectorToolElem.classList.remove("active");
    }

    //Generator
    if (generatorTool.isEnabled && !generatorElem.classList.contains("active")) {
        generatorElem.classList.add("active");
    }
    else if (!generatorTool.isEnabled && generatorElem.classList.contains("active")) {
        generatorElem.classList.remove("active");
    }

    //Selector menu
    if (!selectorToolMenu.isShown() && Window.currentTool == selectorTool && selectorTool.shape != hasSelectedShape) {
        hasSelectedShape = selectorTool.shape;
        selectorToolMenu.show();
    } else if (Window.currentTool != selectorTool || (Window.currentTool == selectorTool && selectorTool.shape == null)) {
        selectorToolMenu.hide();
    }

    //Selector menu
    if (!generatorMenu.isShown() && Window.currentTool == generatorTool) {
        generatorMenu.show();
    } else if (Window.currentTool != generatorTool) {
        generatorMenu.hide();
    }
}

function toggleDrawingTool() {
    if (Window.currentTool != null && Window.currentTool != drawingTool) { Window.currentTool.disable(); }
    Window.currentTool = drawingTool;
    if (drawingTool.isEnabled) {
        drawingTool.disable();
        Window.currentTool = null;
    }
    else {
        drawingTool.enable();
    }
}

function toggleSelectorTool() {
    if (Window.currentTool != null && Window.currentTool != selectorTool) { Window.currentTool.disable(); }
    Window.currentTool = selectorTool;
    if (selectorTool.isEnabled) {
        selectorTool.disable();
        Window.currentTool = null;
    }
    else {
        selectorTool.enable();
    }
}

function toggleGeneratorTool() {
    if (Window.currentTool != null && Window.currentTool != generatorTool) { Window.currentTool.disable(); }
    Window.currentTool = generatorTool;
    if (generatorTool.isEnabled) {
        generatorTool.disable();
        Window.currentTool = null;
    }
    else {
        generatorTool.enable();
    }
}

function recenter(){
    cursor.resetOffset();
}

function confirmSelected() {
    if (Window.currentTool == selectorTool) {
        selectorTool.deselectShape();
    }
}

function deleteSelected(){
    if(Window.currentTool == selectorTool){
        selectorTool.deleteSelected();
    }
    else if(Window.currentTool == drawingTool){
        drawingTool.setData([]);
    }
}

function updateToolMode(mode){
    Window.currentTool.canAdd = mode == "multiTool";
    Window.currentTool.canDelete = mode == "multiTool";
    Window.currentTool.canInsert = mode == "multiTool";
    Window.currentTool.canMove = mode == "multiTool";

    if (mode == "add") {
        Window.currentTool.canAdd = true;
    }
    else if (mode == "move") {
        Window.currentTool.canMove = true;
    }
    else if (mode == "delete") {
        Window.currentTool.canDelete = true;
    }
    else if (mode == "insert") {
        Window.currentTool.canInsert = true;
    }
}

function updateSettings(){
    var elems = document.getElementsByName("daknok");
    var daknok = 0;
    for (let i = 0; i < elems.length; i++) {
        const elem = elems[i];
        if(elem.checked){
            daknok = parseFloat(elem.getAttribute("data-margin"));
            break;
        }
    }

    elems = document.getElementsByName("dakrand");
    var dakrand = 0;
    for (let i = 0; i < elems.length; i++) {
        const elem = elems[i];
        if(elem.checked){
            dakrand = parseFloat(elem.getAttribute("data-margin"));
            break;
        }
    }

    elems = document.getElementsByName("gootdetail");
    var gootdetail = 0;
    for (let i = 0; i < elems.length; i++) {
        const elem = elems[i];
        if(elem.checked){
            gootdetail = parseFloat(elem.getAttribute("data-margin"));
            break;
        }
    }
    
    generatorTool.marginU = daknok;
    generatorTool.marginLR = dakrand;
    generatorTool.marginD = gootdetail;
}