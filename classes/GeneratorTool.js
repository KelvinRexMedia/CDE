import Shape from "./Shape";
import Vector2 from "./Vector2";
import Collision from "./Collision";
import Tile from "./Tile";
import JarvisAlgorithm from "./JarvisAlgorithm";
import HullK from './hull';

export default class GeneratorTool {
    isEnabled = false;

    canAdd = true;
    canDelete = true;
    canInsert = true;
    canMove = true;

    //options
    margin = 0;
    rowOffsetMode = false;
    overhang = 0;
    offsetX = 0;
    offsetY = 0;

    debugStartingPoint = true;
    debugInset = true;
    debugOutset = true;
    debugBoundingBox = false;
    debugRaycast = false;
    debugTiles = false;
    debugParallel = false;

    #buffer = null;
    #tiles = null;
    #renderer = null;
    #totalWidth = 0;
    #totalHeight = 0;
    #dummyWidth = 0;
    #dummyHeight = 0;
    #tileWidth = 0;
    #tileHeight = 0;
    #densitySpacing = 10;
    #sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

    constructor() {
        this.#renderer = Renderer.instance;
        this.#buffer = createGraphics(Settings.mapSizeX, Settings.mapSizeY);
        this.#tiles = [];
    }

    update() {
        image(this.#buffer, 0, 0);
    }

    enable() {
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
    }

    generate() {
        var insets = [];
        var overhangs = [];
        var outsets = [];

        this.#buffer.clear();
        var shapes = this.#renderer.getAll();
        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            if(shape.isAllowed && !shape.isGenerated){
                var inset = this.#createInset(shape);
                var overhang = this.#createOverhang(shape);
                inset.lineMargins = shape.lineMargins;
                var points = inset.getVertices();
                var pointsOverhang = overhang.getVertices();
                insets.push(inset);
                overhangs.push(overhang);


                //visualize inset
                this.#buffer.push();
                for (let i = 0; i < pointsOverhang.length; i++) {
                    const vc = pointsOverhang[i];
                    const vn = pointsOverhang[i + 1 < pointsOverhang.length ? i + 1 : 0];
                    this.#buffer.drawingContext.setLineDash([15, 15]);
                    this.#buffer.stroke(0, 0, 255);
                    this.#buffer.strokeWeight(3);
                    this.#buffer.line(vc.x, vc.y, vn.x, vn.y);
                }
                for (let i = 0; i < points.length; i++) {
                    const vc = points[i];
                    const vn = points[i + 1 < points.length ? i + 1 : 0];
                    this.#buffer.drawingContext.setLineDash([15, 15]);
                    this.#buffer.stroke(255, 0, 0);
                    this.#buffer.strokeWeight(3);
                    this.#buffer.line(vc.x, vc.y, vn.x, vn.y);
                }
                this.#buffer.pop();
            }
            else {
                var outset = this.#createOutset(shape);
                var points = outset.getVertices();
                outsets.push(outset);

                //visualize outset
                this.#buffer.push();
                for (let i = 0; i < points.length; i++) {
                    const vc = points[i];
                    const vn = points[i + 1 < points.length ? i + 1 : 0];
                    this.#buffer.drawingContext.setLineDash([15, 15]);
                    this.#buffer.stroke(0, 0, 0);
                    this.#buffer.strokeWeight(3);
                    this.#buffer.line(vc.x, vc.y, vn.x, vn.y);
                }
                this.#buffer.pop();
            }
        }

        for (let i = 0; i < insets.length; i++) {
            const inset = insets[i];
            this.#buffer.stroke(0, 0, 255);
            this.#buffer.strokeWeight(2);
            var boundingBox = overhangs[i].getBoundingBox();
            this.#buffer.fill(255, 255, 255, 0);
            this.#buffer.rect(boundingBox.x, boundingBox.y, boundingBox.w, boundingBox.h);
        }

        this.#tiles = [];
        this.#totalWidth = 0;
        this.#totalHeight = 0;
        this.#dummyWidth = 0;
        this.#dummyHeight = 0;
        this.#tileWidth = 0;
        this.#tileHeight = 0;

        for (let i = 0; i < insets.length; i++) {
            const inset = insets[i];
            this.#generateTiles(shapes[i], inset, overhangs[i], outsets);
        }
    }

    #createInset(shape) {
        //calculate inset
        var insets = [];
        this.#buffer.beginShape();
        var points = shape.getVertices();
        this.#buffer.push();
        
        for (let i = 0; i < points.length; i++) {
            const vc = points[i];
            const vp = points[i - 1 >= 0 ? i - 1 : points.length - 1];
            const vn = points[i + 1 <= points.length - 1 ? i + 1 : 0];

            var mp = 5;
            var mn = 5;

            mp = parseInt(shape.lineMargins[i - 1 >= 0 ? i - 1 : points.length - 1].split('|')[1]);
            mn = parseInt(shape.lineMargins[i].split('|')[1]);

            if ((vp.x == vc.x && vc.x == vn.x) || (vp.y == vc.y && vc.y == vn.y)) {
                continue;
            }

            var dirN = vn.getCopy().remove(vc).normalized();
            dirN.multiply(new Vector2(mn, mn));
            var dirP = vp.getCopy().remove(vc).normalized();
            dirP.multiply(new Vector2(mp, mp));
            var posN = dirN.getCopy().add(vc);
            var posP = dirP.getCopy().add(vc);
            
            // Stap 2
            var perpendicularStartPointP = this.#getPerpendicularPoint(posP.x, posP.y, vp.x, vp.y, mp, 'right');
            var perpendicularEndPointP = this.#getPerpendicularPoint(posP.x, posP.y, vp.x, vp.y, mp, 'left');
            var perpendicularStartPointN = this.#getPerpendicularPoint(posN.x, posN.y, vn.x, vn.y, mn, 'right');
            var perpendicularEndPointN = this.#getPerpendicularPoint(posN.x, posN.y, vn.x, vn.y, mn, 'left');
            
            if (this.debugParallel) {
                this.#buffer.fill(0, 0, 255); // BLAUW
                this.#buffer.stroke(0, 0, 0);
                this.#buffer.text("SPP", perpendicularStartPointP.x - 20, perpendicularStartPointP.y);
                this.#buffer.text("SPN", perpendicularStartPointN.x - 10, perpendicularStartPointN.y);
                this.#buffer.text("EPP", perpendicularEndPointP.x + 20, perpendicularEndPointP.y);
                this.#buffer.text("EPN", perpendicularEndPointN.x + 10, perpendicularEndPointN.y);
            }

            // Stap 3
            var dBuffer = 5;
            var newPosP = this.#calculateInsetPoint(shape, posP, perpendicularStartPointP, perpendicularEndPointP, dBuffer, this.debugParallel);
            var newPosN = this.#calculateInsetPoint(shape, posN, perpendicularStartPointN, perpendicularEndPointN, dBuffer, this.debugParallel);

            if (Collision.pointPoint(newPosP.x, newPosP.y, newPosN.x, newPosN.y)) {
                insets.push(new Vector2(newPosN.x, newPosN.y));
            } else {
                var directionP = vp.getCopy().remove(vc).normalized();
                var startPointP = Vector2.add(newPosP, directionP.multiplyScalar(1000));
                var endPointP = Vector2.add(newPosP, directionP.multiplyScalar(-1000));

                var directionN = vn.getCopy().remove(vc).normalized();
                var startPointN = Vector2.add(newPosN, directionN.multiplyScalar(1000));
                var endPointN = Vector2.add(newPosN, directionN.multiplyScalar(-1000));

                var collisionPoint = this.#lineIntersection(startPointP, endPointP, startPointN, endPointN);
                insets.push(collisionPoint);


                if (this.debugParallel) {
                    this.#buffer.circle(startPointN.x, startPointN.y, 5);
                    this.#buffer.line(startPointN.x, startPointN.y, endPointN.x, endPointN.y, 5);
                    this.#buffer.line(startPointP.x, startPointP.y, endPointP.x, endPointP.y, 5);
                    this.#buffer.fill(0, 255, 0);
                    this.#buffer.text("Collision Point", collisionPoint.x - 30, collisionPoint.y - 10);
                    this.#buffer.circle(collisionPoint.x, collisionPoint.y, 10);
                }
            }

            if (this.debugParallel) {
                this.#buffer.text(i, vc.x, vc.y + 10);
                this.#buffer.fill(0, 255, 0);
                this.#buffer.circle(posP.x, posP.y, 5);
                this.#buffer.circle(posN.x, posN.y, 5);
                this.#buffer.fill(255, 0, 0);
                this.#buffer.circle(newPosP.x, newPosP.y, 10);
                this.#buffer.circle(newPosN.x, newPosN.y, 10);
            }
        }
        this.#buffer.vertex(insets[0].x, insets[0].y);
        this.#buffer.noStroke();
        this.#buffer.noFill();
        this.#buffer.endShape();
        this.#buffer.pop();

        return new Shape(insets);
    }

    #createOverhang(shape) {
        var insets = [];
        this.#buffer.beginShape();
        var points = shape.getVertices();
        this.#buffer.push();
        
        for (let i = 0; i < points.length; i++) {
            // Overhang Variables
            var enableOverhangP = false;
            var enableOverhangN = false;
            const vc = points[i];
            const vp = points[i - 1 >= 0 ? i - 1 : points.length - 1];
            const vn = points[i + 1 <= points.length - 1 ? i + 1 : 0];
            
            var mp = 5;
            var mn = 5;
            var op = 0;
            var on = 0;

            mp = parseInt(shape.lineMargins[i - 1 >= 0 ? i - 1 : points.length - 1].split('|')[1]);
            mn = parseInt(shape.lineMargins[i].split('|')[1]);

            op = parseInt(shape.lineMargins[i - 1 >= 0 ? i - 1 : points.length - 1].split('|')[2]);
            on = parseInt(shape.lineMargins[i].split('|')[2]);

            if(op != 0) enableOverhangP = true;
            if(on != 0) enableOverhangN = true;

            if ((vp.x == vc.x && vc.x == vn.x) || (vp.y == vc.y && vc.y == vn.y)) {
                continue;
            }

            var dirN = vn.getCopy().remove(vc).normalized();
            var dirP = vp.getCopy().remove(vc).normalized();
            dirP.multiply(new Vector2(enableOverhangP ? op : mp, enableOverhangP ? op : mp));
            dirN.multiply(new Vector2(enableOverhangN ? on : mn, enableOverhangN ? on : mn));
            var posN = dirN.getCopy().add(vc);
            var posP = dirP.getCopy().add(vc);
            
            // Stap 2
            var perpendicularStartPointP = this.#getPerpendicularPoint(posP.x, posP.y, vp.x, vp.y, enableOverhangP ? op : mp, 'right');
            var perpendicularEndPointP = this.#getPerpendicularPoint(posP.x, posP.y, vp.x, vp.y, enableOverhangP ? op : mp, 'left');
            var perpendicularStartPointN = this.#getPerpendicularPoint(posN.x, posN.y, vn.x, vn.y, enableOverhangN ? on : mn, 'right');
            var perpendicularEndPointN = this.#getPerpendicularPoint(posN.x, posN.y, vn.x, vn.y, enableOverhangN ? on : mn, 'left');
            
            if (this.debugParallel) {
                this.#buffer.fill(0, 0, 255); // BLAUW
                this.#buffer.stroke(0, 0, 0);
                this.#buffer.text("SPP", perpendicularStartPointP.x - 20, perpendicularStartPointP.y);
                this.#buffer.text("SPN", perpendicularStartPointN.x - 10, perpendicularStartPointN.y);
                this.#buffer.text("EPP", perpendicularEndPointP.x + 20, perpendicularEndPointP.y);
                this.#buffer.text("EPN", perpendicularEndPointN.x + 10, perpendicularEndPointN.y);
            }

            // Stap 3
            var dBuffer = 5;
            var newPosP, newPosN;
            if(!enableOverhangP) newPosP = this.#calculateInsetPoint(shape, posP, perpendicularStartPointP, perpendicularEndPointP, dBuffer, this.debugParallel);
            else newPosP = this.#calculateOutsetPoint(shape, posP, perpendicularStartPointP, perpendicularEndPointP, this.debugParallel);
            if(!enableOverhangN) newPosN = this.#calculateInsetPoint(shape, posN, perpendicularStartPointN, perpendicularEndPointN, dBuffer, this.debugParallel);
            else newPosN = this.#calculateOutsetPoint(shape, posN, perpendicularStartPointN, perpendicularEndPointN, this.debugParallel);

            if (Collision.pointPoint(newPosP.x, newPosP.y, newPosN.x, newPosN.y)) {
                insets.push(new Vector2(newPosN.x, newPosN.y));
            } else {
                var directionP = vp.getCopy().remove(vc).normalized();
                var startPointP = Vector2.add(newPosP, directionP.multiplyScalar(1000));
                var endPointP = Vector2.add(newPosP, directionP.multiplyScalar(-1000));

                var directionN = vn.getCopy().remove(vc).normalized();
                var startPointN = Vector2.add(newPosN, directionN.multiplyScalar(1000));
                var endPointN = Vector2.add(newPosN, directionN.multiplyScalar(-1000));

                var collisionPoint = this.#lineIntersection(startPointP, endPointP, startPointN, endPointN);
                insets.push(collisionPoint);

                if (this.debugParallel) {
                    this.#buffer.circle(startPointN.x, startPointN.y, 5);
                    this.#buffer.line(startPointN.x, startPointN.y, endPointN.x, endPointN.y, 5);
                    this.#buffer.line(startPointP.x, startPointP.y, endPointP.x, endPointP.y, 5);
                    this.#buffer.fill(0, 255, 0);
                    this.#buffer.text("Collision Point", collisionPoint.x - 30, collisionPoint.y - 10);
                    this.#buffer.circle(collisionPoint.x, collisionPoint.y, 10);
                }
            }

            if (this.debugParallel) {
                this.#buffer.text(i, vc.x, vc.y + 10);
                this.#buffer.fill(0, 255, 0);
                this.#buffer.circle(posP.x, posP.y, 5);
                this.#buffer.circle(posN.x, posN.y, 5);
                this.#buffer.fill(255, 0, 0);
                this.#buffer.circle(newPosP.x, newPosP.y, 10);
                this.#buffer.circle(newPosN.x, newPosN.y, 10);
            }
        }
        this.#buffer.vertex(insets[0].x, insets[0].y);
        this.#buffer.noStroke();
        this.#buffer.noFill();
        this.#buffer.endShape();
        this.#buffer.pop();

        return new Shape(insets);
    }

    #createOutset(shape) {
        //calculate outset
        var outsets = [];
        this.#buffer.beginShape();
        var points = shape.getVertices();
        this.#buffer.push();

        for (let i = 0; i < points.length; i++) {
            const vc = points[i];
            const vp = points[i - 1 >= 0 ? i - 1 : points.length - 1];
            const vn = points[i + 1 <= points.length - 1 ? i + 1 : 0];

            var mp = 0;
            var mn = 0;
            if (shape.lineMargins[i - 1 >= 0 ? i - 1 : points.length - 1] != null) {
                mp = parseInt(shape.lineMargins[i - 1 >= 0 ? i - 1 : points.length - 1].split('|')[1]);
            }
            if (shape.lineMargins[i] != null) {
                mn = parseInt(shape.lineMargins[i].split('|')[1]);
            }

            //ToDo: make it detect diagonal as well
            //If aligned with previous and next vertice along the x OR y axis
            if ((vp.x == vc.x && vc.x == vn.x) || (vp.y == vc.y && vc.y == vn.y)) {
                continue;
            }

            var dirN = vn.getCopy().remove(vc).normalized();
            dirN.multiply(new Vector2(mp, mp));
            var dirP = vp.getCopy().remove(vc).normalized();
            dirP.multiply(new Vector2(mn, mn));
            var posN = dirN.getCopy().add(vc);
            var posP = dirP.getCopy().add(vc);

            // Stap 2
            var perpendicularStartPointP = this.#getPerpendicularPoint(posP.x, posP.y, vp.x, vp.y, mp, 'right');
            var perpendicularEndPointP = this.#getPerpendicularPoint(posP.x, posP.y, vp.x, vp.y, mp, 'left');

            var perpendicularStartPointN = this.#getPerpendicularPoint(posN.x, posN.y, vn.x, vn.y, mn, 'right');
            var perpendicularEndPointN = this.#getPerpendicularPoint(posN.x, posN.y, vn.x, vn.y, mn, 'left');

            if (this.debugParallel) {
                this.#buffer.fill(0, 0, 255); // BLAUW
                this.#buffer.stroke(0, 0, 0);
                this.#buffer.text("SPP", perpendicularStartPointP.x - 20, perpendicularStartPointP.y);
                this.#buffer.text("SPN", perpendicularStartPointN.x - 10, perpendicularStartPointN.y);
                this.#buffer.text("EPP", perpendicularEndPointP.x + 20, perpendicularEndPointP.y);
                this.#buffer.text("EPN", perpendicularEndPointN.x + 10, perpendicularEndPointN.y);

                this.#buffer.circle(perpendicularStartPointP.x, perpendicularStartPointP.y, 10);
                this.#buffer.circle(perpendicularStartPointN.x, perpendicularStartPointN.y, 10);
                this.#buffer.circle(perpendicularEndPointP.x, perpendicularEndPointP.y, 10);
                this.#buffer.circle(perpendicularEndPointN.x, perpendicularEndPointN.y, 10);
            }

            // Stap 3
            var newPosP = this.#calculateOutsetPoint(shape, posP, perpendicularStartPointP, perpendicularEndPointP, this.debugParallel); 
            var newPosN = this.#calculateOutsetPoint(shape, posN, perpendicularStartPointN, perpendicularEndPointN, this.debugParallel);

            // Check if points are on the same coordinates
            if (Collision.pointPoint(newPosP.x, newPosP.y, newPosN.x, newPosN.y)) {
                outsets.push(new Vector2(newPosN.x, newPosN.y));
            } else {
                // Draw a line parallel of original line
                var directionP = vp.getCopy().remove(vc).normalized();
                var startPointP = Vector2.add(newPosP, directionP.multiplyScalar(1000));
                var endPointP = Vector2.add(newPosP, directionP.multiplyScalar(-1000));

                var directionN = vn.getCopy().remove(vc).normalized();
                var startPointN = Vector2.add(newPosN, directionN.multiplyScalar(1000));
                var endPointN = Vector2.add(newPosN, directionN.multiplyScalar(-1000));

                var collisionPoint = this.#lineIntersection(startPointP, endPointP, startPointN, endPointN);
                if (this.debugParallel) {
                    this.#buffer.circle(startPointN.x, startPointN.y, 5);
                    this.#buffer.line(startPointN.x, startPointN.y, endPointN.x, endPointN.y, 5);
                    this.#buffer.line(startPointP.x, startPointP.y, endPointP.x, endPointP.y, 5);
                    this.#buffer.fill(0, 255, 0);
                    this.#buffer.text("Collision Point", collisionPoint.x - 30, collisionPoint.y - 10);
                    this.#buffer.circle(collisionPoint.x, collisionPoint.y, 10);
                }
                outsets.push(collisionPoint);
            }

            if (this.debugParallel) {
                this.#buffer.text(i, vc.x, vc.y + 10);
                this.#buffer.fill(0, 255, 0);
                this.#buffer.circle(posP.x, posP.y, 10);
                this.#buffer.circle(posN.x, posN.y, 10);
            }
        }
        this.#buffer.vertex(outsets[0].x, outsets[0].y);
        this.#buffer.noStroke();
        this.#buffer.noFill();
        this.#buffer.endShape();
        this.#buffer.pop();

        return new Shape(outsets);
    }

    async #generateTiles(shape, inset, overhang, outsets) {
        var self = this;
        var tileSize = new Vector2(1035 / 10, 630 / 10);
        var overlap = 100 / 10;
        var shapePoints = shape.getVertices();
        var insetPoints = inset.getVertices();
        var overhangPoints = overhang.getVertices();
        var boundingBox = overhang.getBoundingBox();

        //Find the top left vertice of the shape
        var topleft = null;
        for (let i = 0; i < insetPoints.length; i++) {
            const vc = insetPoints[i];
            
            if(topleft == null){
                topleft = vc;
            }
            else if(Vector2.distance(vc, boundingBox) < Vector2.distance(topleft, boundingBox)){
                topleft = vc;
            }
        }

        var loop = async(x, y, w, h) => {
            var loops = 0;
            var tempX = x;
            var tempY = y;
            var predictedPoints = [new Vector2(tempX, y), new Vector2(tempX + w, y), new Vector2(tempX + w, y + tempY), new Vector2(tempX, y + tempY)];
            // while (Collision.polygonPolygon(insetPoints, predictedPoints) && loops <= 100) {
                const tile = await this.#generateTile(tempX, tempY, w, h, predictedPoints, inset, overhang, outsets);
                tempX += w;
                // tempY += h;

                predictedPoints = [new Vector2(tempX, y), new Vector2(tempX + w, y), new Vector2(tempX + w, y + tempY), new Vector2(tempX, y + tempY)];
                loops++;
                // await self.#sleep(1000);
            // }
        }
        await loop(topleft.x + self.offsetX + 320, topleft.y + self.offsetY - tileSize.y + overlap, tileSize.x, tileSize.y);

        this.#buffer.fill(255, 0, 0);
        this.#buffer.circle(topleft.x + self.offsetX, topleft.y + self.offsetY, 10);
    }

    async #generateTile(x, y, w, h, predictedPoints, inset, overhang, outsets){
        this.#buffer.stroke(0);
        let startX = x + 200;
        let startY = y;
        let points = [];
        let insetPoints = inset.getVertices();
        for(let a = startY; a <= startY + h; a += this.#densitySpacing){
            for(let b = startX; b <= startX + w; b += this.#densitySpacing){
                if(this.#isInside(insetPoints, b, a)){
                    let forbidden = this.#isInsideForbiddenShapes(outsets, b, a);
                    if(!forbidden){
                        points.push(createVector(b, a));
                        // points.push(new Vector2(b, a));
                        this.#buffer.circle(b, a, 2);
                    }
                }
            }
        }
        points.sort((a, b) => a.x - b.x);
        console.log(points);

        let maxDistance = 10;
        let index = 2;
        let nextIndex = -1;
        let shapeHull = [];
        let mostLeft, current, next;

        // mostLeft = points[0];
        // current = mostLeft;
        // hull.push(current);
        // next = points[1];

        // var loop = true;
        // while(loop){
        //     var checking = points[index];
        //     const a = p5.Vector.sub(next, current);
        //     const b = p5.Vector.sub(checking, current);
        //     const cross = a.cross(b);

        //     this.#buffer.clear();
        //     for (let i = 0; i < points.length; i++) {
        //         const point = points[i];
        //         this.#buffer.circle(point.x, point.y, 2);
        //         // this.#buffer.text(i, point.x, point.y);
        //     }
            
        //     this.#buffer.stroke(255, 0, 0);
        //     this.#buffer.line(current.x, current.y, checking.x, checking.y);
        //     this.#buffer.stroke(0);
        //     if(next != mostLeft){
        //         this.#buffer.line(current.x, current.y, next.x, next.y);
        //     }
            
        //     if(cross.z < 0){
        //         const distance = current.dist(checking);
        //         if(maxDistance === -1 || (distance <= maxDistance && distance != 0)){
        //             next = checking;
        //             nextIndex = index;
        //         }
        //     }
                
        //     index++;
        //     if(index == points.length){
        //         if(next == mostLeft){
        //             console.log('done');
        //             loop = false;
        //         } else {
        //             hull.push(next);
        //             current = next;
        //             if(index >= 0){
        //                 console.log("Splicing", nextIndex);
        //                 points.splice(nextIndex, 1);
        //             }
        //             index = 0;
        //             nextIndex = -1;
        //             next = mostLeft;
        //         }
        //     }
        //     // await this.#sleep(50);
        // }

        // calculate alpha/ concave hull

        shapeHull = HullK(points, 1050);

        // const hull = JarvisAlgorithm.calculate(points, this.#densitySpacing);
        this.#buffer.fill(0, 0, 255, 50);
        this.#buffer.beginShape();
        for (let i = 0; i < shapeHull.length; i++) {
            const point = shapeHull[i];
            this.#buffer.vertex(point.x, point.y);
        }
        this.#buffer.endShape(CLOSE);
        // return hull;
    }

    #lineIntersection(pointA, pointB, pointC, pointD) {
        var z1 = (pointA.x - pointB.x);
        var z2 = (pointC.x - pointD.x);
        var z3 = (pointA.y - pointB.y);
        var z4 = (pointC.y - pointD.y);
        var dist = z1 * z4 - z3 * z2;

        var tempA = (pointA.x * pointB.y - pointA.y * pointB.x);
        var tempB = (pointC.x * pointD.y - pointC.y * pointD.x);
        var xCoor = (tempA * z2 - z1 * tempB) / dist;
        var yCoor = (tempA * z4 - z3 * tempB) / dist;
        return new Vector2(xCoor, yCoor);
    }

    #getPerpendicularPoint(x1, y1, x2, y2, distance, direction) {
        let dx = x2 - x1;
        let dy = y2 - y1;
        let length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
        if (direction === 'left') {
            return new Vector2(x1 + dy * distance, y1 - dx * distance);
        } else {
            return new Vector2(x1 - dy * distance, y1 + dx * distance);
        }
    }

    #calculateInsetPoint(shape, point, startPoint, endPoint, dBuffer, debug = false){
        let newPos = null;

        if (Collision.polygonCircle(shape.getVertices(), startPoint.x, startPoint.y, 1) && Collision.polygonCircle(shape.getVertices(), endPoint.x, endPoint.y, 1)) {
            const directionStart = new Vector2(startPoint.x, startPoint.y).remove(point).normalized();
            const directionEnd = new Vector2(endPoint.x, endPoint.y).remove(posP).normalized();

            const raycastPSFalse = this.#raycast([shape], point, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(point, startPoint), false);
            const raycastPSTrue = this.#raycast([shape], point, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(point, startPoint), true);
            if (raycastPSFalse == null && raycastPSTrue == null) {
                if (debug) {
                    this.#buffer.fill(0, 255, 0);
                    this.#buffer.circle(startPoint.x, startPoint.y, 5);
                }
                newPos = startPoint;
            } else if (Vector2.distance(point, raycastSFalse) <= dBuffer && raycastSTrue == null) {
                newPos = startPoint;
            } else if (Vector2.distance(point, raycastSTrue) <= dBuffer && raycastSFalse == null) {
                newPos = startPoint;
            } else {
                if (debug) {
                    this.#buffer.line(point.x, point.y, startPoint.x, startPoint.y, 5);
                }
                newPos = endPoint;
            }

            if (newPos == null) {
                const raycastPEFalse = this.#raycast([shape], point, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(point, endPoint), false);
                const raycastPETrue = this.#raycast([shape], point, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(point, endPoint), true);
                if (raycastPEFalse == null && raycastPETrue == null) {
                    if (debug) {
                        this.#buffer.fill(0, 255, 0);
                        this.#buffer.circle(endPoint.x, endPoint.y, 5);
                    }
                    newPos = endPoint;
                } else if (Vector2.distance(point, raycastEFalse) <= dBuffer && raycastETrue == null) {
                    newPos = endPoint;
                } else if (Vector2.distance(point, raycastETrue) <= dBuffer && raycastEFalse == null) {
                    newPos = endPoint;
                }else{
                    if (debug) {
                        this.#buffer.line(posP.x, posP.y, endPoint.x, endPoint.y, 5);
                    }
                    newPos = startPoint;
                }
            }
        }
        else if (!Collision.polygonCircle(shape.getVertices(), startPoint.x, startPoint.y, 1) && !Collision.polygonCircle(shape.getVertices(), endPoint.x, endPoint.y, 1)) {
            var directionStart = new Vector2(startPoint.x, startPoint.y).remove(point).normalized();
            var directionEnd = new Vector2(endPoint.x, endPoint.y).remove(point).normalized();

            var raycastSFalse = this.#raycast([shape], point, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(point, startPoint), false);
            var raycastSTrue = this.#raycast([shape], point, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(point, startPoint), true);
            if (raycastSFalse != null && raycastSTrue != null) {
                newPos = startPoint;
            }

            var raycastEFalse = this.#raycast([shape], point, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(point, endPoint), false);
            var raycastETrue = this.#raycast([shape], point, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(point, endPoint), true);
            if (raycastEFalse != null && raycastETrue != null) {
                newPos = endPoint;
            }
        }
        // Als start punt in shape zitten  
        else if (Collision.polygonCircle(shape.getVertices(), startPoint.x, startPoint.y, 1)) newPos = startPoint;
        // Anders pak eind punt
        else newPos = endPoint;


        return newPos;
    }

    #calculateOutsetPoint(shape, point, startPoint, endPoint, debug = true){
        let newPos = null;

        if (!Collision.polygonCircle(shape.getVertices(), startPoint.x, startPoint.y, 1) && !Collision.polygonCircle(shape.getVertices(), endPoint.x, endPoint.y, 1)) {
            var directionStart = new Vector2(startPoint.x, startPoint.y).remove(point).normalized();
            var directionEnd = new Vector2(endPoint.x, endPoint.y).remove(point).normalized();
            var start = this.#raycastAll([shape], point, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(point, startPoint), true);
            var end = this.#raycastAll([shape], point, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(point, endPoint), true);
            if (start.length < 2) {
                if (start.length != 0) {
                    for (let l = 0; l < start.length; l++) {
                        if (!start[l].equals(point)) newPos = endPoint;
                    }
                } else newPos = startPoint
            }
            if (end.length < 2) {
                if (end.length != 0) {
                    for (let l = 0; l < end.length; l++) {
                        if (!end[l].equals(point))  newPos = startPoint; 
                    }
                } else newPos = endPoint;
            }
        
        }
        // !Als beide punten NIET in shape zitten 
        else if (Collision.polygonCircle(shape.getVertices(), startPoint.x, startPoint.y, 1) && Collision.polygonCircle(shape.getVertices(), endPoint.x, endPoint.y, 1)) {
            var directionStart = new Vector2(startPoint.x, startPoint.y).remove(point).normalized();
            var directionEnd = new Vector2(endPoint.x, endPoint.y).remove(point).normalized();
        
            var raycastPSFalse = this.#raycast([shape], point, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(point, startPoint), false);
            var raycastPSTrue = this.#raycast([shape], point, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(point, startPoint), true);
            if (raycastPSFalse != null && raycastPSTrue != null) {
                if (debug) {this.#buffer.fill(0, 255, 0);
                this.#buffer.circle(startPoint.x, startPoint.y, 5);}
                newPos = startPoint;
            }
        
            var raycastPEFalse = this.#raycast([shape], point, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(point, endPoint), false);
            var raycastPETrue = this.#raycast([shape], point, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(point, endPoint), true);
            if (raycastPEFalse != null && raycastPETrue != null) {
                if (debug) {this.#buffer.fill(0, 255, 0);
                this.#buffer.circle(endPoint.x, endPoint.y, 5);}
                newPos = endPoint;
            }
        }
        // Als start punt in shape zitten  
        else if (!Collision.polygonCircle(shape.getVertices(), startPoint.x, startPoint.y, 1)) newPos = startPoint;
        // Anders pak eind punt
        else newPos = endPoint;

        return newPos;
    }

    #raycast(shapes, from, dir, dist, ignoreSelf = true) {
        var collisions = this.#raycastAll(shapes, from, dir, dist, ignoreSelf);
        if (collisions.length > 0) {
            return collisions[0];
        }
        return null;
    }

    #raycastAll(shapes, from, dir, dist, ignoreSelf = true) {
        var collisions = [];
        var keys = [];
        var end = from.getCopy().remove(new Vector2(dir.x, dir.y).multiply(new Vector2(dist, dist)));
        if(this.debugRaycast){
            this.#buffer.fill(0);
            this.#buffer.line(from.x, from.y, end.x, end.y);
        }

        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            const vertices = shape.getVertices();

            for (let r = 0; r < vertices.length; r++) {
                const vn = vertices[r + 1 < vertices.length ? r + 1 : 0];
                const vc = vertices[r];
                var key = i + "_" + r + "_" + (r + 1 < vertices.length ? r + 1 : 0);
                if(keys.includes(key)){
                    continue;
                }

                if (Collision.linePoint(vn.x, vn.y, vc.x, vc.y, from.x, from.y) && ignoreSelf) {
                    keys.push(key);
                    continue;
                }

                var collision = Collision.lineLineCollision(from.x, from.y, end.x, end.y, vc.x, vc.y, vn.x, vn.y);
                if (collision != null) {
                    keys.push(key);
                    collisions.push(collision);
                }
            }
        }

        collisions.sort((a, b) => Vector2.distance(from, a) > Vector2.distance(from, b) ? 1 : -1);
        return collisions;
    }

    #isInsideForbiddenShapes(forbiddenShapes, x, y, includeLines = true) {
        var isInside = false;
        for (let i = 0; i < forbiddenShapes.length; i++) {
            const shape = forbiddenShapes[i];
            const shapePoints = shape.getVertices();
            if (this.#isInside(shapePoints, x, y, includeLines)) {
                isInside = true;
            }
        }

        return isInside;
    }

    #isInside(vertices, x, y, includeLines = true) {
        var isInside = false;

        if (Collision.polygonPoint(vertices, x, y)) {
            isInside = true;
        }

        for (let i = 0; i < vertices.length; i++) {
            const vc = vertices[i];
            const vn = vertices[i + 1 <= vertices.length - 1 ? i + 1 : 0];

            if (Collision.linePoint(vc.x, vc.y, vn.x, vn.y, x, y)) {
                if (includeLines){
                    isInside = true;
                }
                else {
                    isInside = false;
                }
                break;
            }
        }

        return isInside;
    }

    toJSON() {
        var t = { 'Alucobond': [], 'X-Roof': [], 'Ventilatiekap': [], 'Dummy X-Roof': [] };

        this.#totalWidth = 0;
        this.#totalHeight = 0;
        this.#dummyWidth = 0;
        this.#dummyHeight = 0;
        for (let i = 0; i < this.#tiles.length; i++) {
            const tile = this.#tiles[i];

            if (tile.isDummy) {
                t['Alucobond'].push(tile.toJSON());
                this.#totalWidth += tile.width;
                this.#totalHeight += tile.height;
                this.#dummyWidth += tile.width;
                this.#dummyHeight += tile.height;
            }
            else if (tile.isVent == "dummy") {
                t['Dummy X-Roof'].push(tile.toJSON());
                this.#totalWidth += tile.width;
                this.#totalHeight += tile.height;
                this.#dummyWidth += tile.width;
                this.#dummyHeight += tile.height;
            }
            else if (tile.isVent == "vent") {
                t['Ventilatiekap'].push(tile.toJSON());
            }
            else {
                t['X-Roof'].push(tile.toJSON());
                this.#totalWidth += tile.width;
                this.#totalHeight += tile.height;
                this.#tileWidth += tile.width;
                this.#tileHeight += tile.height;
            }
        }

        return { 'tiles': t, 'width': this.#totalWidth, 'height': this.#totalHeight, 'tile_width': this.#tileWidth, 'tile_height': this.#tileHeight, 'dummy_width': this.#dummyWidth, 'dummy_height': this.#dummyHeight };
    }

    fromJSON(json) {
        if (!json) { return; }

        if (json.tiles && false) {
            this.#buffer.clear();

            if (json.tiles['Alucobond']) {
                for (let i = 0; i < json.tiles['Alucobond'].length; i++) {
                    const tile = json.tiles['Alucobond'][i];

                    var vertices = [];
                    for (let i = 0; i < tile.vertices.length; i++) {
                        const vertice = tile.vertices[i];
                        vertices.push(Vector2.fromJSON(vertice));
                    }
                    this.#tiles.push(new Tile(vertices, this.#buffer, tile.isDummy, tile.isVent));
                }
            }

            if (json.tiles['X-Roof']) {
                for (let i = 0; i < json.tiles['X-Roof'].length; i++) {
                    const tile = json.tiles['X-Roof'][i];

                    var vertices = [];
                    for (let i = 0; i < tile.vertices.length; i++) {
                        const vertice = tile.vertices[i];
                        vertices.push(Vector2.fromJSON(vertice));
                    }
                    this.#tiles.push(new Tile(vertices, this.#buffer, tile.isDummy, tile.isVent));
                }
            }

            if (json.tiles['Ventilatiekap']) {
                for (let i = 0; i < json.tiles['Ventilatiekap'].length; i++) {
                    const tile = json.tiles['Ventilatiekap'][i];

                    var vertices = [];
                    for (let i = 0; i < tile.vertices.length; i++) {
                        const vertice = tile.vertices[i];
                        vertices.push(Vector2.fromJSON(vertice));
                    }
                    this.#tiles.push(new Tile(vertices, this.#buffer, tile.isDummy, tile.isVent));
                }
            }

            if (json.tiles['Dummy X-Roof']) {
                for (let i = 0; i < json.tiles['Dummy X-Roof'].length; i++) {
                    const tile = json.tiles['Dummy X-Roof'][i];

                    var vertices = [];
                    for (let i = 0; i < tile.vertices.length; i++) {
                        const vertice = tile.vertices[i];
                        vertices.push(Vector2.fromJSON(vertice));
                    }
                    this.#tiles.push(new Tile(vertices, this.#buffer, tile.isDummy, tile.isVent));
                }
            }
        }

        if (json.width) { this.#totalWidth = json.width; }
        if (json.height) { this.#totalHeight = json.height; }

        if (json.dummy_width) { this.#dummyWidth = json.dummy_width; }
        if (json.dummy_height) { this.#dummyHeight = json.dummy_height; }

        if (json.tile_width) { this.#tileWidth = json.tile_width; }
        if (json.tile_height) { this.#tileHeight = json.tile_height; }

        if (json.offsetX) { this.offsetX = json.offsetX; }
        if (json.offsetY) { this.offsetY = json.offsetY; }
    }

    getTiles() {
        return this.#tiles;
    }

    redraw(){
        this.#buffer.clear();
        for (let i = 0; i < this.#tiles.length; i++) {
            const tile = this.#tiles[i];
            
            tile.generate();
        }
    }
}