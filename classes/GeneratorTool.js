import Shape from "./Shape";
import Vector2 from "./Vector2";
import Collision from "./Collision";
import Color from "./Color";
import Tile from "./Tile";

export default class GeneratorTool {
    isEnabled = false;

    canAdd = true;
    canDelete = true;
    canInsert = true;
    canMove = true;

    //options
    marginU = 25;
    marginLR = 25;
    marginD = 25;
    margin = 5;
    rowOffsetMode = false;

    #buffer = null;
    #renderer = null;
    #tiles = [];

    constructor(){
        this.#renderer = Renderer.instance;
        this.#buffer = createGraphics(Settings.mapSizeX, Settings.mapSizeY);
    }

    update(){
        image(this.#buffer, 0, 0);
    }

    enable(){
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
    }

    generate(){
        var insets = [];
        var outsets = [];
        var hideVisuals = false;

        this.#buffer.clear();
        var shapes = this.#renderer.getAll();
        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            if (shape.isAllowed && !shape.isGenerated){
                var inset = this.#createInset(shape);
                var points = inset.getVertices();
                insets.push(inset);

                if(!hideVisuals){
                    //visualize inset
                    this.#buffer.push();
                    for (let i = 0; i < points.length; i++) {
                        const vc = points[i];
                        const vn = points[i + 1 < points.length ? i + 1 : 0];
                        this.#buffer.drawingContext.setLineDash([15, 15]);
                        this.#buffer.stroke(255, 0, 0);
                        this.#buffer.strokeWeight(2);
                        this.#buffer.line(vc.x, vc.y, vn.x, vn.y);
                    }
                    this.#buffer.pop();
                }
            }
            else{
                var outset = this.#createOutset(shape);
                var points = outset.getVertices();
                outsets.push(outset);

                if(!hideVisuals){
                    //visualize outset
                    this.#buffer.push();
                    for (let i = 0; i < points.length; i++) {
                        const vc = points[i];
                        const vn = points[i + 1 < points.length ? i + 1 : 0];
                        this.#buffer.drawingContext.setLineDash([15, 15]);
                        this.#buffer.stroke(0, 0, 0);
                        this.#buffer.strokeWeight(2);
                        this.#buffer.line(vc.x, vc.y, vn.x, vn.y);
                    }
                    this.#buffer.pop();
                }
            }
        }

        if(!hideVisuals){
            for (let i = 0; i < insets.length; i++) {
                const inset = insets[i];
                this.#buffer.stroke(0);
                this.#buffer.strokeWeight(2);
                var boundingBox = inset.getBoundingBox();
                this.#buffer.fill(255, 255, 255, 0);
                this.#buffer.rect(boundingBox.x, boundingBox.y, boundingBox.w, boundingBox.h);
            }

            for (let i = 0; i < outsets.length; i++) {
                const outset = outsets[i];
                this.#buffer.stroke(0);
                this.#buffer.strokeWeight(2);
                var boundingBox = outset.getBoundingBox();
                this.#buffer.fill(255, 0, 0, 150);
                this.#buffer.rect(boundingBox.x, boundingBox.y, boundingBox.w, boundingBox.h);
            }
        }

        for (let i = 0; i < insets.length; i++) {
            const inset = insets[i];
            this.#generateTiles(inset, outsets);
        }
    }

    #createInset(shape){
        //calculate inset
        var insets = [];
        this.#buffer.beginShape();
        var points = shape.getVertices();
        var hideVisuals = true;
        this.#buffer.push();

        for (let i = 0; i < points.length; i++) {
            const vc = points[i];
            const vp = points[i - 1 >= 0 ? i - 1 : points.length - 1];
            const vn = points[i + 1 <= points.length - 1 ? i + 1 : 0];
            
            //ToDo: make it detect diagonal as well
            //If aligned with previous and next vertice along the x OR y axis
            if ((vp.x == vc.x && vc.x == vn.x) || (vp.y == vc.y && vc.y == vn.y)) {
                continue;
            }
            
            var dirN = vn.getCopy().remove(vc).normalized();
            var marginN = Math.abs(this.#getMargin(dirN));
            dirN.multiply(new Vector2(marginN, marginN));
            
            var dirP = vp.getCopy().remove(vc).normalized();
            var marginP = Math.abs(this.#getMargin(dirP));
            dirP.multiply(new Vector2(marginP, marginP));
            
            var posN = dirN.getCopy().add(vc);
            var posP = dirP.getCopy().add(vc);
            var pos = dirN.getCopy().add(vc).add(dirP);

            if(!hideVisuals){
                this.#buffer.fill(0, 255, 0);
                this.#buffer.circle(pos.x, pos.y, 10);
                this.#buffer.circle(posP.x, posP.y, 10);
                this.#buffer.circle(posN.x, posN.y, 10);
            }

            if(!Collision.polygonCircle(shape.getVertices(), pos.x, pos.y, 5)){
                dirN = vn.getCopy().remove(vc).normalized();
                marginN = Math.abs(this.#getMargin(dirN));
                dirN.multiply(new Vector2(marginN, marginN))
                
                dirP = vp.getCopy().remove(vc).normalized();
                marginP = Math.abs(this.#getMargin(dirP));
                dirP.multiply(new Vector2(marginP, marginP));
                
                posN = vc.getCopy().remove(dirN);
                posP = vc.getCopy().remove(dirP);
                pos = vc.getCopy().remove(dirN).remove(dirP);
                if(!hideVisuals){
                    this.#buffer.fill(255, 0, 0);
                    this.#buffer.circle(posN.x, posN.y, 10);
                    this.#buffer.circle(posP.x, posP.y, 10);
                    this.#buffer.circle(pos.x, pos.y, 10);
                }
            }

            insets.push(pos);
        }

        this.#buffer.vertex(insets[0].x, insets[0].y);
        this.#buffer.noStroke();
        this.#buffer.noFill();
        this.#buffer.endShape();
        this.#buffer.pop();

        return new Shape(insets);
    }

    #createOutset(shape){
        //calculate outset
        var outsets = [];
        this.#buffer.beginShape();
        var points = shape.getVertices();
        var hideVisuals = true;
        this.#buffer.push();

        for (let i = 0; i < points.length; i++) {
            const vc = points[i];
            const vp = points[i - 1 >= 0 ? i - 1 : points.length - 1];
            const vn = points[i + 1 <= points.length - 1 ? i + 1 : 0];
            
            //ToDo: make it detect diagonal as well
            //If aligned with previous and next vertice along the x OR y axis
            if ((vp.x == vc.x && vc.x == vn.x) || (vp.y == vc.y && vc.y == vn.y)) {
                continue;
            }

            var dirP = vp.getCopy().remove(vc).normalized().multiply(new Vector2(this.margin, this.margin));
            var dirN = vn.getCopy().remove(vc).normalized().multiply(new Vector2(this.margin, this.margin));
            
            var posP = vc.getCopy().remove(dirP);
            var posN = vc.getCopy().remove(dirN);
            var pos = vc.getCopy().remove(dirN).remove(dirP);
            if(!hideVisuals){
                this.#buffer.fill(0, 255, 0);
                this.#buffer.circle(posP.x, posP.y, 10);
                this.#buffer.circle(posN.x, posN.y, 10);
                this.#buffer.circle(pos.x, pos.y, 10);
            }

            if(Collision.polygonCircle(shape.getVertices(), pos.x, pos.y, 5)){
                var posP = vc.getCopy().add(dirP);
                var posN = vc.getCopy().add(dirN);
                var pos = vc.getCopy().add(dirN).add(dirP);
                if(!hideVisuals){
                    this.#buffer.fill(0, 0, 255);
                    this.#buffer.circle(posP.x, posP.y, 10);
                    this.#buffer.circle(posN.x, posN.y, 10);
                    this.#buffer.circle(pos.x, pos.y, 10);
                }
            }

            outsets.push(pos);
        }
        this.#buffer.vertex(outsets[0].x, outsets[0].y);
        this.#buffer.noStroke();
        this.#buffer.noFill();
        this.#buffer.endShape();
        this.#buffer.pop();

        return new Shape(outsets);
    }

    #getMargin(dir){
        if(dir.equals(Vector2.up())){
            // console.log("up", this.marginU);
            return this.marginU;
        }
        else if(dir.equals(Vector2.right())){
            // console.log("right", this.marginLR);
            return this.marginLR;
        }
        else if(dir.equals(Vector2.down())){
            // console.log("down", this.marginD);
            return this.marginD;
        }
        else if(dir.equals(Vector2.left())){
            // console.log("left", this.marginLR);
            return this.marginLR;
        }
        else{
            var margin = 0;
            if(dir.x > 0){
                margin += dir.x * this.marginLR;
            }
            else{
                margin += Math.abs(dir.x) * this.marginLR;
                // margin += dir.x * this.marginLR;
            }

            if(dir.y > 0){
                margin += dir.y * this.marginU;
            }
            else{
                margin += Math.abs(dir.y) * this.marginD;
                // margin += dir.y * this.marginD;
            }
            // console.log("ERROR:", dir, margin);
            return margin;
        }
    }

    #sleep = (delay) => new Promise((resolve)=> setTimeout(resolve, delay));
    #generateTiles(inset, outsets){
        var boundingBox = inset.getBoundingBox();
        var tileWidth = 820 / 10;
        var tileHeight = 600 / 10;
        var yWithTile = -1;
        var insetPoints = inset.getVertices();
        var rowIndex = 0;
        var withOffset = false;

        var attemptPlaceTile = async(x, y, width, height) => {
            var points = [
                new Vector2(x, y),
                new Vector2(x + width, y),
                new Vector2(x + width, y + height),
                new Vector2(x, y + height),
            ];

            var hasEnoughSpace = this.#canBePlaced(insetPoints, outsets, points);

            if (hasEnoughSpace) {
                var tile = this.#getTile(x, y, points);
                yWithTile = y;
                this.#tiles.push(tile);
                return true;
            } else {
                if (width > 20 && height > 20) {
                    //Incase we need to slow down the calculation (if the browser freezes up)
                    await this.#sleep(10);

                    var placeTile = true; 
                    var count = 0;
                    var newPoints = [];
                    // Loop through the vector point of the tile
                    for(let i =0; i < points.length; i++){
                        const vc = points[i];
                        const vp = points[i - 1 >= 0 ? i - 1 : points.length - 1];
                        const vn = points[i + 1 <= points.length - 1 ? i + 1 : 0];

                        //check if point is outside the inset shape
                        //check if the previous point is inside the inset shape
                        //check if the next point is inside the inset shape

                        // if(!this.#isInside(insetPoints, [vc, vc, vc, vc])){
                        //     this.#buffer.fill(200, 0, 0);
                        //     this.#buffer.circle(vc.x, vc.y, 10);
                        //     await this.#sleep(1000);
                        // }

                        // if(true){

                            // Check if the vector point is outside of the insetpoints
                            if(!Collision.polygonPoint(insetPoints, points[i].x, points[i].y)){
                                var intersection;
                                count++;
                                this.#buffer.circle(points[i].x , points[i].y ,10);
                                // Draw invisible line to previous vector and the next one
                                if (i == points.length - 1) {
                                    // // Previous
                                    // // this.#buffer.line(points[i].x , points[i].y, points[i - 1].x , points[i - 1].y);
                                    // // await this.#sleep(100);
                                    // if (Collision.polygonLine(insetPoints, points[i], points[i - 1])){
                                    //     intersection = this.#polygonLineWithCoordinates(insetPoints, points[i], points[i - 1]);
                                    //     newPoints.push(intersection);
                                    // }
                                    // // Next
                                    // // this.#buffer.line(points[i].x , points[i].y, points[0].x , points[0].y);
                                    // // await this.#sleep(100);
                                    // if (Collision.polygonLine(insetPoints, points[i], points[0])){
                                    //     intersection = this.#polygonLineWithCoordinates(insetPoints, points[i], points[0]);
                                    //     newPoints.push(intersection);
                                    // }
                                } else {
                                    // Previous
                                    
                                    // if (Collision.polygonLine(insetPoints, points[i], points[i - 1])){
                                    //     this.#buffer.line(points[i].x , points[i].y, points[i - 1].x , points[i - 1].y);
                                    // await this.#sleep(100);
                                    //     intersection = this.#polygonLineWithCoordinates(insetPoints, points[i], points[i - 1]);
                                    //     newPoints.push(intersection);
                                    // }
                                    // Next
                                    
                                    if (Collision.polygonLine(insetPoints, points[i], points[i + 1])){
                                        this.#buffer.line(points[i].x , points[i].y, points[i + 1].x , points[i + 1].y);
                                        await this.#sleep(100);
                                        intersection = this.#polygonLineWithCoordinates(insetPoints, points[i], points[i + 1]);
                                        newPoints.push(intersection);
                                    }
                                }
                                
                                // // Update x and y of point
                                // points[i].x = intersection.x;
                                // points[i].y = intersection.y;
                            }
                            // Check if all the vector point is outside of the insetpoints 
                            if(count == 4 ) placeTile = false
    
                           
                        // }
                    }
                    print(points);
                    print(newPoints);
                }
                // Place Tile
                if(placeTile){
                    var tile = this.#getTile(x, y, newPoints);
                    yWithTile = y;
                    this.#tiles.push(tile);
                    return true;
                }
            }
            return false;
        }

        var syncedFunc = async(x, y) => {
            var tilePlaced = attemptPlaceTile(x, y, tileWidth, tileHeight);

            //Incase we need to slow down the calculation (if the browser freezes up)
            await this.#sleep(10);

            x += tileWidth;
            if (x >= boundingBox.x + boundingBox.w) {
                y += yWithTile < y ? 1 : tileHeight;
                rowIndex++
                if (this.rowOffsetMode) {
                    x = rowIndex % 2 != 0 ? boundingBox.x + (tileWidth / 2) : boundingBox.x;
                }
                else{
                    x = boundingBox.x;
                }
            }

            if (y <= boundingBox.y + boundingBox.h) {
                syncedFunc(x, y);
            }
        }

        syncedFunc(boundingBox.x, boundingBox.y);
    }
    
    #canBePlaced(insetPoints, outsets, points) {
        var hasEnoughSpace = true;
        if (this.#isInside(insetPoints, points)) {
            for (let i = 0; i < outsets.length; i++) {
                const outset = outsets[i];
                const outsetPoints = outset.getVertices();

                if (this.#isColliding(outsetPoints, points)) {
                    hasEnoughSpace = false;
                    break;
                }
            }
        }
        else {
            hasEnoughSpace = false;
        }

        return hasEnoughSpace;
    }

    #isColliding(zonePoints, points){
        if(Collision.polygonPolygon(zonePoints, points) || Collision.polygonPoint(zonePoints, points[0].x, points[0].y) || Collision.polygonPoint(zonePoints, points[1].x, points[1].y) || Collision.polygonPoint(zonePoints, points[2].x, points[2].y) || Collision.polygonPoint(zonePoints, points[3].x, points[3].y)){
            return true;
        }
        return false;
    }

    #isInside(zonePoints, points){
        if(Collision.polygonPoint(zonePoints, points[0].x, points[0].y) && Collision.polygonPoint(zonePoints, points[1].x, points[1].y) && Collision.polygonPoint(zonePoints, points[2].x, points[2].y) && Collision.polygonPoint(zonePoints, points[3].x, points[3].y)){
            return true;
        }
        return false;
    }

    #getTile(x,y, vertices){
        return new Tile(vertices, this.#buffer);
    }

    #getIntersectionPoint(p1, p2, r1, r2, r3, r4)
    {
        var intersection;
        intersection = this.#lineIntersection(p1,p2,r1,r2);
        if(intersection == null) intersection = this.#lineIntersection(p1,p2,r2,r3);
        if(intersection == null) intersection = this.#lineIntersection(p1,p2,r3,r4);
        if(intersection == null) intersection = this.#lineIntersection(p1,p2,r4,r1);
        return intersection;
    }

    #lineIntersection(pointA, pointB, pointC, pointD) {
        var z1 = (pointA.x - pointB.x);
        var z2 = (pointC.x - pointD.x);
        var z3 = (pointA.y - pointB.y);
        var z4 = (pointC.y - pointD.y);
        var dist = z1 * z4 - z3 * z2;
        if (dist == 0) {
          return null;
        }
        var tempA = (pointA.x * pointB.y - pointA.y * pointB.x);
        var tempB = (pointC.x * pointD.y - pointC.y * pointD.x);
        var xCoor = (tempA * z2 - z1 * tempB) / dist;
        var yCoor = (tempA * z4 - z3 * tempB) / dist;
      
        if (xCoor < Math.min(pointA.x, pointB.x) || xCoor > Math.max(pointA.x, pointB.x) ||
          xCoor < Math.min(pointC.x, pointD.x) || xCoor > Math.max(pointC.x, pointD.x)) {
          return null;
        }
        if (yCoor < Math.min(pointA.y, pointB.y) || yCoor > Math.max(pointA.y, pointB.y) ||
          yCoor < Math.min(pointC.y, pointD.y) || yCoor > Math.max(pointC.y, pointD.y)) {
          return null;
        }
      
        return new Vector2(xCoor, yCoor);
    }

    #polygonLineWithCoordinates(vertices, vector1, vector2){
        //loop over all vertices
        var next = 0;
        for (let current = 0; current < vertices.length; current++) {

            //get next vertice in list (wrap around to 0 if we exceed the vertices array length)
            next = current + 1;
            if(next == vertices.length){
                next = 0;
            }

            //convert 2 vertices into a line
            const x3 = vertices[current].x;
            const y3 = vertices[current].y;
            const x4 = vertices[next].x;
            const y4 = vertices[next].y;
            
            //detect if the vertices lines intersect with the given line
            var hit = this.#lineIntersection(vector1, vector2, vertices[current], vertices[next]);
            if(hit != null){
                return hit;
            }
        }

        return false;
    }
}