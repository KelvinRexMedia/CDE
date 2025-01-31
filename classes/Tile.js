import Color from "./Color";
import Vector2 from "./Vector2";

export default class Tile {
    width = 0;
    height = 0;
    pos = null;
    isDummy = false;
    isVent = 'normal';
    
    #buffer = null;
    #vertices = [];
    #color = null;
    #isValid = false;

    constructor(vertices = [], buffer = null, isDummy = false, isVent = 'normal') {
        this.#buffer = buffer;
        this.#vertices = vertices;
        this.width = 0;
        this.height = 0;
        this.pos = this.#vertices[0];
        this.isDummy = isDummy;
        this.isVent = isVent;

        if(this.#vertices.length <= 0){return;}
        for (let i = this.#vertices.length - 1; i >= 0; i--) {
            const vc = this.#vertices[i];
            if(isNaN(vc.x) || isNaN(vc.y)){
                this.#vertices.splice(i, 1);
            }
        }

        const xArr = this.#vertices.map(a => a.x);
        const yArr = this.#vertices.map(a => a.y);
        this.width = (Math.max(...xArr) - Math.min(...xArr));
        this.height = (Math.max(...yArr) - Math.min(...yArr));
        this.#isValid = this.width >= 20 && this.height >= 20;
        
        if (this.#isValid) {
            if (buffer == null) {
                this.#buffer = createGraphics(this.width, this.height);
            }

            // console.log(this.isDummy, this.#vertices.length, this.width == 82, this.height == 50, this.height == 60);
            // if(this.isDummy && this.#vertices.length == 4 && this.width == 82 && (this.height == 50 || this.height == 60)){
            //     this.isDummy = false;
            //     isDummy = false;
            // }

            if(isDummy){
                this.#color = Settings.type == "Zwart" ? Settings.dummyZwartBackground : Settings.dummyTerracottaBackground;
            }else{
                this.#color = Settings.type == "Zwart" ? Settings.tileZwartBackground : Settings.tileTerracottaBackground;
            }
            this.generate();
        }
    }

    getVertices(){
        return this.#vertices;
    }

    toJSON() {
        var vertices = [];
        for (let i = 0; i < this.#vertices.length; i++) {
            const vertice = this.#vertices[i];
            vertices.push(vertice.toJSON());
        }

        return { "vertices": vertices, "width": this.width, "height": this.height, "isDummy": this.isDummy, "isVent": this.isVent };
    }

    generate() {
        this.#buffer.beginShape();
        for (let i = 0; i < this.#vertices.length; i++) {
            this.#buffer.vertex(this.#vertices[i].x, this.#vertices[i].y);
        }
        this.#buffer.vertex(this.#vertices[0].x, this.#vertices[0].y);

        this.#buffer.push();
        if (this.isVent == 'dummy') {
            var color = Settings.type == "Zwart" ? Settings.dummyZwartBackground : Settings.dummyTerracottaBackground;
            var rgba = color.rgba();
        }else var rgba = this.#color.rgba();
        this.#buffer.fill(rgba.r, rgba.g, rgba.b, rgba.a);
        this.#buffer.endShape();
        this.#buffer.pop();

        if (this.isVent == 'vent') {
            const xArr = this.#vertices.map(a => a.x);
            const yArr = this.#vertices.map(a => a.y);
            var pos = new Vector2(Math.min(...xArr) + (this.height / 2) - 10, Math.min(...yArr) + (this.height / 2) + 8);

            this.#buffer.push();
            this.#buffer.fill(255, 0, 0);
            this.#buffer.textSize(25);
            this.#buffer.text("Vent", pos.x, pos.y);
            this.#buffer.pop();
        }

        
    }

    getBoundingBox() {
        if (!this.#isValid) { return { "x": 0, "y": 0, "w": 0, "h": 0}; }
        
        const xArr = this.#vertices.map(a => a.x);
        const yArr = this.#vertices.map(a => a.y);
        const width = (Math.max(...xArr) - Math.min(...xArr));
        const height = (Math.max(...yArr) - Math.min(...yArr));
        return {
            "x": this.pos,
            "y": this.pos,
            "w": width,
            "h": height
        };
    }

    switchType(){
        //if tile is full sized than you can change it to/from dummy
        //if tile is full sized than you can change it to/from vent
        // var boundingBox = this.getBoundingBox();
        // if(w == 82 && h == 60){
            
        // }
        if(this.isVent == 'normal') this.isVent = 'vent';
        else if(this.isVent == 'vent') this.isVent = 'dummy';
        else if(this.isVent == 'dummy') this.isVent = 'normal';

        // console.log('isVent',this.isVent);
        // this.isVent = !this.isVent;
    }

    clone() {
        return new Tile(Vector2.copyAll(this.#vertices), this.#buffer, this.isDummy, this.isVent);
    }
}