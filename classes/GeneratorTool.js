import Shape from "./Shape";
import Vector2 from "./Vector2";
import Collision from "./Collision";
import Tile from "./Tile";

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

    debugBoundingBox = true;
    debugRaycast = true;
    debugInset = true;
    debugOutset = true;
    debugTiles = true;
    debugParallel = true;
    debugStartingPoint = true;

    #buffer = null;
    #renderer = null;
    #tiles = null;
    #totalWidth = 0;
    #totalHeight = 0;
    #dummyWidth = 0;
    #dummyHeight = 0;
    #tileWidth = 0;
    #tileHeight = 0;
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
        console.log('Generating...');
        var insets = [];
        var outsets = [];
        var hideVisuals = true;

        this.#buffer.clear();
        var shapes = this.#renderer.getAll();
        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            if (shape.isAllowed && !shape.isGenerated) {
                var inset = this.#createInset(shape);
                inset.lineMargins = shape.lineMargins;
                var points = inset.getVertices();
                insets.push(inset);

                if (!hideVisuals) {
                    //visualize inset
                    this.#buffer.push();
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
            }
            else {
                var outset = this.#createOutset(shape);
                var points = outset.getVertices();
                outsets.push(outset);

                if (!hideVisuals) {
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
        }

        if (!hideVisuals) {
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

    #createInset(shape) {
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

            var mp = 0;
            var mn = 0;
            if (shape.lineMargins[i - 1 >= 0 ? i - 1 : points.length - 1].split("|")[0] != "daknok1" && 
                shape.lineMargins[i - 1 >= 0 ? i - 1 : points.length - 1].split("|")[0] != "dakrand1" && 
                shape.lineMargins[i - 1 >= 0 ? i - 1 : points.length - 1].split("|")[0] != "gootdetail3") {
                if (shape.lineMargins[i - 1 >= 0 ? i - 1 : points.length - 1] != null) {
                    mp = parseInt(shape.lineMargins[i - 1 >= 0 ? i - 1 : points.length - 1].split('|')[1]);
                }
            }
            if (shape.lineMargins[i].split("|")[0] != "daknok1" && shape.lineMargins[i].split("|")[0] != "dakrand1" && shape.lineMargins[i].split("|")[0] != "gootdetail3") {
                if (shape.lineMargins[i] != null) {
                    mn = parseInt(shape.lineMargins[i].split('|')[1]);
                }
            }

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

            if (!hideVisuals) {
                this.#buffer.fill(0, 0, 255); // BLAUW
                this.#buffer.stroke(0, 0, 0);
                this.#buffer.text("SPP", perpendicularStartPointP.x - 20, perpendicularStartPointP.y);
                this.#buffer.text("SPN", perpendicularStartPointN.x - 10, perpendicularStartPointN.y);
                this.#buffer.text("EPP", perpendicularEndPointP.x + 20, perpendicularEndPointP.y);
                this.#buffer.text("EPN", perpendicularEndPointN.x + 10, perpendicularEndPointN.y);
            }

            // Stap 3
            // Check welk punt we moeten gebruiken
            var newPosP, newPosN;
            var dBuffer = 5
            // Als beide punten in shape zitten
            if (Collision.polygonCircle(shape.getVertices(), perpendicularStartPointP.x, perpendicularStartPointP.y, 1) && Collision.polygonCircle(shape.getVertices(), perpendicularEndPointP.x, perpendicularEndPointP.y, 1)) {
                var directionStart = new Vector2(perpendicularStartPointP.x, perpendicularStartPointP.y).remove(posP).normalized();
                var directionEnd = new Vector2(perpendicularEndPointP.x, perpendicularEndPointP.y).remove(posP).normalized();

                var raycastPSFalse = this.#raycast([shape], posP, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posP, perpendicularStartPointP), false);
                var raycastPSTrue = this.#raycast([shape], posP, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posP, perpendicularStartPointP), true);
                if (raycastPSFalse == null && raycastPSTrue == null) {
                    if (!hideVisuals) {
                        this.#buffer.fill(0, 255, 0);
                        this.#buffer.circle(perpendicularStartPointP.x, perpendicularStartPointP.y, 5);
                        print(i + '- GEEN COLLISION RICHTING perpendicularStartPointP');
                    }
                    newPosP = perpendicularStartPointP;
                } else if (Vector2.distance(posP, raycastPSFalse) <= dBuffer && raycastPSTrue == null) {
                    newPosP = perpendicularStartPointP;
                } else if (Vector2.distance(posP, raycastPSTrue) <= dBuffer && raycastPSFalse == null) {
                    newPosP = perpendicularStartPointP;
                } else {
                    if (!hideVisuals) {
                        print(i + '- WEL COLLISION RICHTING perpendicularStartPointP');
                        this.#buffer.line(posP.x, posP.y, perpendicularStartPointP.x, perpendicularStartPointP.y, 5);
                    }
                    newPosP = perpendicularEndPointP;
                }

                if (newPosP == null) {
                    var raycastPEFalse = this.#raycast([shape], posP, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posP, perpendicularEndPointP), false);
                    var raycastPETrue = this.#raycast([shape], posP, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posP, perpendicularEndPointP), true);
                    if (raycastPEFalse == null && raycastPETrue == null) {
                        if (!hideVisuals) {
                            this.#buffer.fill(0, 255, 0);
                            this.#buffer.circle(perpendicularEndPointP.x, perpendicularEndPointP.y, 5);
                            print(i + '- GEEN COLLISION RICHTING perpendicularEndPointP');
                        }
                        newPosP = perpendicularEndPointP;
                    } else if (Vector2.distance(posP, raycastPEFalse) <= dBuffer && raycastPETrue == null) {
                        newPosN = perpendicularEndPointN;
                    } else if (Vector2.distance(posP, raycastPETrue) <= dBuffer && raycastPEFalse == null) {
                        newPosN = perpendicularEndPointN;
                    } else {
                        if (!hideVisuals) {
                            print(i + '- WEL COLLISION RICHTING perpendicularEndPointP');
                            this.#buffer.line(posP.x, posP.y, perpendicularEndPointP.x, perpendicularEndPointP.y, 5);
                        }
                        newPosP = perpendicularStartPointP;
                    }
                }

            }
            // Als beide punten NIET in shape zitten 
            else if (!Collision.polygonCircle(shape.getVertices(), perpendicularStartPointP.x, perpendicularStartPointP.y, 1) && !Collision.polygonCircle(shape.getVertices(), perpendicularEndPointP.x, perpendicularEndPointP.y, 1)) {
                var directionStart = new Vector2(perpendicularStartPointP.x, perpendicularStartPointP.y).remove(posP).normalized();
                var directionEnd = new Vector2(perpendicularEndPointP.x, perpendicularEndPointP.y).remove(posP).normalized();

                var raycastPSFalse = this.#raycast([shape], posP, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posP, perpendicularStartPointP), false);
                var raycastPSTrue = this.#raycast([shape], posP, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posP, perpendicularStartPointP), true);
                if (raycastPSFalse != null && raycastPSTrue != null) {
                    this.#buffer.fill(0, 255, 0);
                    this.#buffer.circle(perpendicularStartPointP.x, perpendicularStartPointP.y, 5);
                    newPosP = perpendicularStartPointP;
                }

                var raycastPEFalse = this.#raycast([shape], posP, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posP, perpendicularEndPointP), false);
                var raycastPETrue = this.#raycast([shape], posP, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posP, perpendicularEndPointP), true);
                if (raycastPEFalse != null && raycastPETrue != null) {
                    this.#buffer.fill(0, 255, 0);
                    this.#buffer.circle(perpendicularEndPointP.x, perpendicularEndPointP.y, 5);
                    newPosP = perpendicularEndPointP;
                }
            }
            // Als start punt in shape zitten  
            else if (Collision.polygonCircle(shape.getVertices(), perpendicularStartPointP.x, perpendicularStartPointP.y, 1))
                newPosP = perpendicularStartPointP;
            // Anders pak eind punt
            else newPosP = perpendicularEndPointP;

            if (Collision.polygonCircle(shape.getVertices(), perpendicularStartPointN.x, perpendicularStartPointN.y, 1) && Collision.polygonCircle(shape.getVertices(), perpendicularEndPointN.x, perpendicularEndPointN.y, 1)) {
                var directionStart = new Vector2(perpendicularStartPointN.x, perpendicularStartPointN.y).remove(posN).normalized();
                var directionEnd = new Vector2(perpendicularEndPointN.x, perpendicularEndPointN.y).remove(posN).normalized();

                var raycastNSFalse = this.#raycast([shape], posN, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posN, perpendicularStartPointN), false);
                var raycastNSTrue = this.#raycast([shape], posN, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posN, perpendicularStartPointN), true);
                if (raycastNSFalse == null && raycastNSTrue == null) {
                    if (!hideVisuals) {
                        this.#buffer.fill(0, 255, 0);
                        print(i + '- GEEN COLLISION RICHTING perpendicularStartPointN');
                        this.#buffer.circle(perpendicularStartPointN.x, perpendicularStartPointN.y, 5);
                    }
                    newPosN = perpendicularStartPointN;
                } else if (Vector2.distance(posN, raycastNSFalse) <= dBuffer && raycastNSTrue == null) {
                    newPosN = perpendicularStartPointN;
                } else if (Vector2.distance(posN, raycastNSTrue) <= dBuffer && raycastNSFalse == null) {
                    newPosN = perpendicularStartPointN;
                } else {
                    if (!hideVisuals) {
                        print(i + '- WEL COLLISION RICHTING perpendicularStartPointN');
                        this.#buffer.line(posN.x, posN.y, perpendicularStartPointN.x, perpendicularStartPointN.y, 5);
                    }
                    newPosN = perpendicularEndPointN;
                }

                if (newPosN == null) {
                    var raycastNEFalse = this.#raycast([shape], posN, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posN, perpendicularEndPointN), false);
                    var raycastNETrue = this.#raycast([shape], posN, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posN, perpendicularEndPointN), true);
                    if (raycastNEFalse == null || raycastNETrue == null) {
                        if (!hideVisuals) {
                            print(i + '- GEEN COLLISION RICHTING perpendicularEndPointN');
                            this.#buffer.fill(0, 255, 0);
                            this.#buffer.circle(perpendicularEndPointN.x, perpendicularEndPointN.y, 5);
                        }
                        newPosN = perpendicularEndPointN;
                    } else if (Vector2.distance(posN, raycastNEFalse) <= dBuffer && raycastNETrue == null) {
                        newPosN = perpendicularEndPointN;
                    } else if (Vector2.distance(posN, raycastNETrue) <= dBuffer && raycastNEFalse == null) {
                        newPosN = perpendicularEndPointN;
                    } else {
                        if (!hideVisuals) {
                            print(i + '- WEL COLLISION RICHTING perpendicularEndPointN');
                            this.#buffer.line(posN.x, posN.y, perpendicularEndPointN.x, perpendicularEndPointN.y, 5);
                        }
                        newPosN = perpendicularStartPointN;
                    }
                }

            } else if (!Collision.polygonCircle(shape.getVertices(), perpendicularStartPointN.x, perpendicularStartPointN.y, 1) && !Collision.polygonCircle(shape.getVertices(), perpendicularEndPointN.x, perpendicularEndPointN.y, 1)) {

                var directionStart = new Vector2(perpendicularStartPointN.x, perpendicularStartPointN.y).remove(posN).normalized();
                var directionEnd = new Vector2(perpendicularEndPointN.x, perpendicularEndPointN.y).remove(posN).normalized();

                var raycastNSFalse = this.#raycast([shape], posN, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posN, perpendicularStartPointN), false);
                var raycastNSTrue = this.#raycast([shape], posN, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posN, perpendicularStartPointN), true);
                if (raycastNSFalse != null && raycastNSTrue != null) {
                    // this.#buffer.fill(0, 255, 0);
                    // print(i + '- WEL COLLISION RICHTING perpendicularStartPointN');
                    // this.#buffer.circle(perpendicularStartPointN.x, perpendicularStartPointN.y, 5);
                    newPosN = perpendicularStartPointN;
                }

                var raycastNEFalse = this.#raycast([shape], posN, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posN, perpendicularEndPointN), false);
                var raycastNETrue = this.#raycast([shape], posN, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posN, perpendicularEndPointN), true);
                if (raycastNEFalse != null && raycastNETrue != null) {
                    if (!hideVisuals) {
                        // this.#buffer.fill(0, 255, 0);
                        // print(i + '- WEL COLLISION RICHTING perpendicularEndPointN');
                        // this.#buffer.circle(perpendicularEndPointN.x, perpendicularEndPointN.y, 5);
                    }
                    newPosN = perpendicularEndPointN;
                }
            } else if (Collision.polygonCircle(shape.getVertices(), perpendicularStartPointN.x, perpendicularStartPointN.y, 1))
                newPosN = perpendicularStartPointN;
            else newPosN = perpendicularEndPointN;


            // Check if points are on the same coordinates
            if (Collision.pointPoint(newPosP.x, newPosP.y, newPosN.x, newPosN.y)) {
                insets.push(new Vector2(newPosN.x, newPosN.y));
                // insets.push(pos);
                // print(i + 'BENIS');
            } else {
                // Draw a line parallel of original line
                var directionP = vp.getCopy().remove(vc).normalized();
                var startPointP = Vector2.add(newPosP, directionP.multiplyScalar(1000));
                var endPointP = Vector2.add(newPosP, directionP.multiplyScalar(-1000));

                var directionN = vn.getCopy().remove(vc).normalized();
                var startPointN = Vector2.add(newPosN, directionN.multiplyScalar(1000));
                var endPointN = Vector2.add(newPosN, directionN.multiplyScalar(-1000));

                var collisionPoint = this.#lineIntersection(startPointP, endPointP, startPointN, endPointN);
                if (!hideVisuals) {
                    this.#buffer.circle(startPointN.x, startPointN.y, 5);
                    this.#buffer.line(startPointN.x, startPointN.y, endPointN.x, endPointN.y, 5);
                    this.#buffer.line(startPointP.x, startPointP.y, endPointP.x, endPointP.y, 5);
                    this.#buffer.fill(0, 255, 0);
                    this.#buffer.text("Collision Point", collisionPoint.x - 30, collisionPoint.y - 10);
                    this.#buffer.circle(collisionPoint.x, collisionPoint.y, 15);
                }
                insets.push(collisionPoint);
            }

            if (!hideVisuals) {
                this.#buffer.text(i, vc.x, vc.y + 10);
                this.#buffer.fill(0, 255, 0);
                // this.#buffer.circle(pos.x, pos.y, 10);
                this.#buffer.circle(posP.x, posP.y, 5);
                this.#buffer.circle(posN.x, posN.y, 5);
                this.#buffer.fill(255, 0, 0);
                this.#buffer.circle(newPosP.x, newPosP.y, 10);
                this.#buffer.circle(newPosN.x, newPosN.y, 10);
            }
            // insets.push(pos);
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
        var hideVisuals = true;
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

            // var dirP = vp.getCopy().remove(vc).normalized().multiply(new Vector2(mn, mn));
            // var dirN = vn.getCopy().remove(vc).normalized().multiply(new Vector2(mp, mp));

            // var posP = vc.getCopy().remove(dirP);
            // var posN = vc.getCopy().remove(dirN);

            var dirN = vn.getCopy().remove(vc).normalized();
            dirN.multiply(new Vector2(mp, mp));

            var dirP = vp.getCopy().remove(vc).normalized();
            dirP.multiply(new Vector2(mn, mn));

            var posN = dirN.getCopy().add(vc);
            var posP = dirP.getCopy().add(vc);
            // Old
            var pos = vc.getCopy().remove(dirN).remove(dirP);

            // Stap 2
            var slopeP = (vp.y - vc.y) / (vp.x - vc.x);
            var slopeN = (vn.y - vc.y) / (vn.x - vc.x);

            var tolerance = .1;

            var perpendicularStartPointP = this.#getPerpendicularPoint(posP.x, posP.y, vp.x, vp.y, mp, 'right');
            var perpendicularEndPointP = this.#getPerpendicularPoint(posP.x, posP.y, vp.x, vp.y, mp, 'left');

            var perpendicularStartPointN = this.#getPerpendicularPoint(posN.x, posN.y, vn.x, vn.y, mn, 'right');
            var perpendicularEndPointN = this.#getPerpendicularPoint(posN.x, posN.y, vn.x, vn.y, mn, 'left');

            if (!hideVisuals) {
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
            // Check welk punt we moeten gebruiken
            var newPosP, newPosN;
            var dBuffer = 5
            // !Als beide punten in shape zitten
            if (!Collision.polygonCircle(shape.getVertices(), perpendicularStartPointP.x, perpendicularStartPointP.y, 1) && !Collision.polygonCircle(shape.getVertices(), perpendicularEndPointP.x, perpendicularEndPointP.y, 1)) {
                var directionStart = new Vector2(perpendicularStartPointP.x, perpendicularStartPointP.y).remove(posP).normalized();
                var directionEnd = new Vector2(perpendicularEndPointP.x, perpendicularEndPointP.y).remove(posP).normalized();
                var start = this.#raycastAll([shape], posP, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posP, perpendicularStartPointP), true);
                var end = this.#raycastAll([shape], posP, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posP, perpendicularEndPointP), true);
                // print('PosP');
                // print(posP);
                // print('start');
                // print(start);
                // print('end');
                // print(end);
                if (start.length < 2) {
                    if (start.length != 0) {
                        for (let l = 0; l < start.length; l++) {
                            if (!start[l].equals(posP)) { newPosP = perpendicularEndPointP; }
                            // newPosP = perpendicularStartPointP;
                        }
                    } else newPosP = perpendicularStartPointP
                }
                if (end.length < 2) {
                    if (end.length != 0) {
                        for (let l = 0; l < end.length; l++) {
                            if (!end[l].equals(posP)) { newPosP = perpendicularStartPointP; }
                            // newPosP = perpendicularEndPointP;
                        }
                    } else newPosP = perpendicularEndPointP;
                }

            }
            // !Als beide punten NIET in shape zitten 
            else if (Collision.polygonCircle(shape.getVertices(), perpendicularStartPointP.x, perpendicularStartPointP.y, 1) && Collision.polygonCircle(shape.getVertices(), perpendicularEndPointP.x, perpendicularEndPointP.y, 1)) {
                var directionStart = new Vector2(perpendicularStartPointP.x, perpendicularStartPointP.y).remove(posP).normalized();
                var directionEnd = new Vector2(perpendicularEndPointP.x, perpendicularEndPointP.y).remove(posP).normalized();

                var raycastPSFalse = this.#raycast([shape], posP, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posP, perpendicularStartPointP), false);
                var raycastPSTrue = this.#raycast([shape], posP, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posP, perpendicularStartPointP), true);
                if (raycastPSFalse != null && raycastPSTrue != null) {
                    this.#buffer.fill(0, 255, 0);
                    this.#buffer.circle(perpendicularStartPointP.x, perpendicularStartPointP.y, 5);
                    newPosP = perpendicularStartPointP;
                }

                var raycastPEFalse = this.#raycast([shape], posP, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posP, perpendicularEndPointP), false);
                var raycastPETrue = this.#raycast([shape], posP, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posP, perpendicularEndPointP), true);
                if (raycastPEFalse != null && raycastPETrue != null) {
                    this.#buffer.fill(0, 255, 0);
                    this.#buffer.circle(perpendicularEndPointP.x, perpendicularEndPointP.y, 5);
                    newPosP = perpendicularEndPointP;
                }
            }
            // Als start punt in shape zitten  
            else if (!Collision.polygonCircle(shape.getVertices(), perpendicularStartPointP.x, perpendicularStartPointP.y, 1))
                newPosP = perpendicularStartPointP;
            // Anders pak eind punt
            else newPosP = perpendicularEndPointP;

            if (!Collision.polygonCircle(shape.getVertices(), perpendicularStartPointN.x, perpendicularStartPointN.y, 1) && !Collision.polygonCircle(shape.getVertices(), perpendicularEndPointN.x, perpendicularEndPointN.y, 1)) {
                var directionStart = new Vector2(perpendicularStartPointN.x, perpendicularStartPointN.y).remove(posN).normalized();
                var directionEnd = new Vector2(perpendicularEndPointN.x, perpendicularEndPointN.y).remove(posN).normalized();
                var start = this.#raycastAll([shape], posN, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posN, perpendicularStartPointN), true);
                var end = this.#raycastAll([shape], posN, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posN, perpendicularEndPointN), true);
                // print('PosP');
                // print(posP);
                // print('start');
                // print(start);
                // print('end');
                // print(end);
                if (start.length < 2) {
                    if (start.length != 0) {
                        for (let l = 0; l < start.length; l++) {
                            if (!start[l].equals(posN)) { newPosN = perpendicularEndPointN; }
                            // newPosP = perpendicularStartPointP;
                        }
                    } else newPosN = perpendicularStartPointN;
                }
                if (end.length < 2) {
                    if (end.length != 0) {
                        for (let l = 0; l < end.length; l++) {
                            if (!end[l].equals(posN)) { newPosN = perpendicularStartPointN; }
                            // newPosP = perpendicularEndPointP;
                        }
                        newPosN = perpendicularStartPointN;
                    }
                }

            } else if (Collision.polygonCircle(shape.getVertices(), perpendicularStartPointN.x, perpendicularStartPointN.y, 1) && Collision.polygonCircle(shape.getVertices(), perpendicularEndPointN.x, perpendicularEndPointN.y, 1)) {

                var directionStart = new Vector2(perpendicularStartPointN.x, perpendicularStartPointN.y).remove(posN).normalized();
                var directionEnd = new Vector2(perpendicularEndPointN.x, perpendicularEndPointN.y).remove(posN).normalized();

                var raycastNSFalse = this.#raycast([shape], posN, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posN, perpendicularStartPointN), false);
                var raycastNSTrue = this.#raycast([shape], posN, new Vector2(-directionStart.x, -directionStart.y), Vector2.distance(posN, perpendicularStartPointN), true);
                if (raycastNSFalse != null && raycastNSTrue != null) {
                    // this.#buffer.fill(0, 255, 0);
                    // print(i + '- WEL COLLISION RICHTING perpendicularStartPointN');
                    // this.#buffer.circle(perpendicularStartPointN.x, perpendicularStartPointN.y, 5);
                    newPosN = perpendicularStartPointN;
                }

                var raycastNEFalse = this.#raycast([shape], posN, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posN, perpendicularEndPointN), false);
                var raycastNETrue = this.#raycast([shape], posN, new Vector2(-directionEnd.x, -directionEnd.y), Vector2.distance(posN, perpendicularEndPointN), true);
                if (raycastNEFalse != null && raycastNETrue != null) {
                    if (!hideVisuals) {
                        // this.#buffer.fill(0, 255, 0);
                        // print(i + '- WEL COLLISION RICHTING perpendicularEndPointN');
                        // this.#buffer.circle(perpendicularEndPointN.x, perpendicularEndPointN.y, 5);
                    }
                    newPosN = perpendicularEndPointN;
                }
            } else if (!Collision.polygonCircle(shape.getVertices(), perpendicularStartPointN.x, perpendicularStartPointN.y, 1))
                newPosN = perpendicularStartPointN;
            else newPosN = perpendicularEndPointN;


            // Check if points are on the same coordinates
            if (Collision.pointPoint(newPosP.x, newPosP.y, newPosN.x, newPosN.y)) {
                outsets.push(new Vector2(newPosN.x, newPosN.y));
                // insets.push(pos);
                // print(i + 'BENIS');
            } else {
                // Draw a line parallel of original line
                var directionP = vp.getCopy().remove(vc).normalized();
                var startPointP = Vector2.add(newPosP, directionP.multiplyScalar(1000));
                var endPointP = Vector2.add(newPosP, directionP.multiplyScalar(-1000));

                var directionN = vn.getCopy().remove(vc).normalized();
                var startPointN = Vector2.add(newPosN, directionN.multiplyScalar(1000));
                var endPointN = Vector2.add(newPosN, directionN.multiplyScalar(-1000));

                var collisionPoint = this.#lineIntersection(startPointP, endPointP, startPointN, endPointN);
                if (!hideVisuals) {
                    this.#buffer.circle(startPointN.x, startPointN.y, 5);
                    this.#buffer.line(startPointN.x, startPointN.y, endPointN.x, endPointN.y, 5);
                    this.#buffer.line(startPointP.x, startPointP.y, endPointP.x, endPointP.y, 5);
                    this.#buffer.fill(0, 255, 0);
                    this.#buffer.text("Collision Point", collisionPoint.x - 30, collisionPoint.y - 10);
                    this.#buffer.circle(collisionPoint.x, collisionPoint.y, 15);
                }
                outsets.push(collisionPoint);
            }

            if (!hideVisuals) {
                this.#buffer.text(i, vc.x, vc.y + 10);
                this.#buffer.fill(0, 255, 0);
                // this.#buffer.circle(pos.x, pos.y, 10);
                this.#buffer.circle(posP.x, posP.y, 10);
                this.#buffer.circle(posN.x, posN.y, 10);
                this.#buffer.fill(255, 0, 0);
                // this.#buffer.circle(newPosP.x, newPosP.y, 10);
                // this.#buffer.circle(newPosN.x, newPosN.y, 10);
            }

            // if (Collision.polygonCircle(shape.getVertices(), pos.x, pos.y, 5)) {
            //     var posP = vc.getCopy().add(dirP);
            //     var posN = vc.getCopy().add(dirN);
            //     var pos = vc.getCopy().add(dirN).add(dirP);
            //     if (!hideVisuals) {
            //         this.#buffer.fill(0, 0, 255);
            //         this.#buffer.circle(posP.x, posP.y, 10);
            //         this.#buffer.circle(posN.x, posN.y, 10);
            //         this.#buffer.circle(pos.x, pos.y, 10);
            //     }
            // }

            // outsets.push(pos);
        }
        this.#buffer.vertex(outsets[0].x, outsets[0].y);
        this.#buffer.noStroke();
        this.#buffer.noFill();
        this.#buffer.endShape();
        this.#buffer.pop();

        return new Shape(outsets);
    }

    async #generateTiles(inset, outsets) {
        var self = this;
        var tileSize = new Vector2(820 / 10, 600 / 10);
        var insetPoints = inset.getVertices();
        var boundingBox = inset.getBoundingBox();
        var count = 0;
        var tiledMode = this.rowOffsetMode;
        var dummySize = this.dummyTileSize;

        this.#tiles = [];
        this.#totalWidth = 0;
        this.#totalHeight = 0;
        this.#dummyWidth = 0;
        this.#dummyHeight = 0;
        this.#tileWidth = 0;
        this.#tileHeight = 0;

        var syncedPlaceTile = async (x, y, predictionPoints) => new Promise((resolve) => {
            var delay = 1;
            var isDummy = false;
            var hideVisuals = true;
            count++;

            setTimeout(() => {
                var results = [];
                var collisions = [];
                if(self.debugTiles){
                    self.#buffer.text(count, predictionPoints[0].x + 10 + tileSize.x / 2, predictionPoints[0].y + 10 + tileSize.y / 2);
                }

                for (let i = 0; i < predictionPoints.length; i++) {
                    const vp = predictionPoints[i - 1 >= 0 ? i - 1 : predictionPoints.length - 1];
                    const vc = predictionPoints[i];
                    const vn = predictionPoints[i + 1 <= predictionPoints.length - 1 ? i + 1 : 0];
                    
                    if(!self.IsInsideForbiddenShapes(outsets, vc.x, vc.y) && self.IsInside(insetPoints, vc.x, vc.y)){
                        var dirP = vp.getCopy().remove(vc).normalized();
                        var dirN = vn.getCopy().remove(vc).normalized();
    
                        if (!hideVisuals){
                            self.#buffer.fill(0);
                            self.#buffer.circle(vc.x, vc.y, 5);
                            self.#buffer.stroke(255, 255, 0);
                            self.#buffer.line(vc.x, vc.y, vc.x + (dirN.x * 20), vc.y + (dirN.y * 20));
                            self.#buffer.stroke(0, 0, 255);
                            self.#buffer.line(vc.x, vc.y, vc.x + (dirP.x * 20), vc.y + (dirP.y * 20));
                        }

                        var distP = Vector2.distance(vc, vp);
                        var raycastP = self.#raycast([inset].concat(outsets), vc, new Vector2(-dirP.x, -dirP.y), distP, true);
                        var distN = Vector2.distance(vc, vn);
                        var raycastN = self.#raycast([inset].concat(outsets), vc, new Vector2(-dirN.x, -dirN.y), distN, true);

                        if(raycastP != null){
                            isDummy = true;
                            results.push(raycastP);
                            // if(self.IsInside(insetPoints, vp.x, vp.y)) 
                                collisions.push({'index': results.length - 1, 'isWall': !self.IsInsideForbiddenShapes(outsets, vp.x, vp.y) && !self.IsInside(insetPoints, vp.x, vp.y) });
                                self.#buffer.stroke(0);
                                if (!hideVisuals) {
                                self.#buffer.fill(255, 255, 0);
                                self.#buffer.circle(raycastP.x, raycastP.y, 3);
                            }
                        }

                        results.push(vc);

                        if (raycastN != null) {
                            isDummy = true;
                            results.push(raycastN);
                            // if(self.IsInside(insetPoints, vn.x, vn.y)) 
                                collisions.push({'index': results.length, 'isWall': !self.IsInsideForbiddenShapes(outsets, vn.x, vn.y) && !self.IsInside(insetPoints, vn.x, vn.y) });
                            if (!hideVisuals) {
                                self.#buffer.stroke(0);
                                self.#buffer.fill(255, 255, 0);
                                self.#buffer.circle(raycastN.x, raycastN.y, 3);
                            }
                        }
                    }
                    else{
                        isDummy = true;
                    }
                }
                var pointsNeedToBeAdded = [];
                for (let r = 0; r < insetPoints.length; r++) {
                    const insetPoint = insetPoints[r];
                    if (self.IsInside(predictionPoints, insetPoint.x, insetPoint.y, false)) {
                        pointsNeedToBeAdded.push(insetPoint);
                    }
                }
                for (let x = 0; x < outsets.length; x++) {
                    const outsetPoints = outsets[x].getVertices();

                    for (let r = 0; r < outsetPoints.length; r++) {
                        const outsetPoint = outsetPoints[r];
                        if (self.IsInside(predictionPoints, outsetPoint.x, outsetPoint.y, false)) {
                            pointsNeedToBeAdded.push(outsetPoint);
                        }
                    }
                }
                
                var extraTile = null;
                //split tile
                if(collisions.length >= 4){
                    if(pointsNeedToBeAdded.length == 1) {
                        console.log(count);
                        console.log(collisions.length, collisions);
                        console.log(results);
                        var index;
                        for (let j = 0; j < collisions.length; j++) {
                            const element = collisions[j];
                            if(!element['isWall']) index = element['index'];
                        }

                        for (let r = 0; r < insetPoints.length; r++) {
                            const insetPoint = insetPoints[r];
                            if (self.IsInside(predictionPoints, insetPoint.x, insetPoint.y, false)) {
                                if (self.IsInside(results, insetPoint.x, insetPoint.y, false)) {
                                    results.splice(index, 0, insetPoint);
                                } else {
                                    const vp = results[index - 1];
                                    const vc = insetPoint;
                                    const vn = results[index];        
                                    // Direction calculation
                                    var dirP = vp.getCopy().remove(vc).normalized();
                                    var dirN = vn.getCopy().remove(vc).normalized();
                                    //Make a shape for the results
                                    var shape = new Shape(results);
                                    var toPrev = self.#raycast([shape], vc, new Vector2(-dirP.x, -dirP.y), Vector2.distance(vp, vc), false);
                                    var toNext = self.#raycast([shape], vc, new Vector2(-dirN.x, -dirN.y), Vector2.distance(vn, vc), false);
                                    results.splice(index, 0, toPrev);
                                    results.splice(index+1, 0, toNext);
                                }
                            }
                        }
                        for (let x = 0; x < outsets.length; x++) {
                            const outsetPoints = outsets[x].getVertices();
                            for (let r = 0; r < outsetPoints.length; r++) {
                                const outsetPoint = outsetPoints[r];
                                if (self.IsInside(predictionPoints, outsetPoint.x, outsetPoint.y, false)) {
                                    if (self.IsInside(results, outsetPoint.x, outsetPoint.y, false)) {
                                        results.splice(index, 0, outsetPoint);
                                    } else {
                                        const vp = results[index - 1];
                                        const vc = outsetPoint;
                                        const vn = results[index];        
                                        // Direction calculation
                                        var dirP = vp.getCopy().remove(vc).normalized();
                                        var dirN = vn.getCopy().remove(vc).normalized();
                                        //Make a shape for the results
                                        var shape = new Shape(results);
                                        var toPrev = self.#raycast([shape], vc, new Vector2(-dirP.x, -dirP.y), Vector2.distance(vp, vc), false);
                                        var toNext = self.#raycast([shape], vc, new Vector2(-dirN.x, -dirN.y), Vector2.distance(vn, vc), false);
                                        results.splice(index, 0, toPrev);
                                        results.splice(index+1, 0, toNext);
                                    }
                                }
                            }
                        }

                        if(!hideVisuals){
                            for (let k = 0; k < results.length; k++) {
                                const element = results[k];
                                self.#buffer.text(k,element.x,element.y);
                            }
                        }
                    }
                    else if(pointsNeedToBeAdded.length >= 2){
                        var newResults = [];
                        for (let i = 0; i < results.length; i++) {
                            const vp = results[i - 1 >= 0 ? i - 1 : results.length - 1];
                            const vc = results[i];
                            const vn = results[i + 1 <= results.length - 1 ? i + 1 : 0];

                            newResults.push(vc);
                            
                            // Direction calculation
                            var dirP = vp.getCopy().remove(vc).normalized();
                            var dirN = vn.getCopy().remove(vc).normalized();
                            // Make 90 degrees angles
                            var maxP = Math.max(Math.abs(dirP.x), Math.abs(dirP.y));
                            var maxN = Math.max(Math.abs(dirN.x), Math.abs(dirN.y));
                            if (maxP === Math.abs(dirP.x)) {dirP.x = dirP.x > 0 ? 1 : -1; dirP.y = 0;}
                            else {dirP.y = dirP.y > 0 ? 1 : -1; dirP.x = 0;}
                            if (maxN === Math.abs(dirN.x)) {dirN.x = dirN.x > 0 ? 1 : -1; dirN.y = 0;}
                            else {dirN.y = dirN.y > 0 ? 1 : -1; dirN.x = 0;}
                            var distanceP = Vector2.distance(vc, vp);
                            var distanceN = Vector2.distance(vc, vn);
                            var hitPointsP = [];
                            var hitPointsN = [];
                            for (let j = 0; j < pointsNeedToBeAdded.length; j++) {
                                const element = pointsNeedToBeAdded[j];
                                if(Collision.lineCircle(vc.x, vc.y, vc.x + dirP.x * distanceP, vc.y + dirP.y * distanceP, element.x, element.y, 5)){
                                    hitPointsP.push(element);
                                }
                                if(Collision.lineCircle(vc.x, vc.y, vc.x + dirN.x * distanceN, vc.y + dirN.y * distanceP, element.x, element.y, 5)){
                                    hitPointsN.push(element);
                                }
                            }
                            
                            if(hitPointsP.length > 0){
                                var closestVector;
                                var closestDistance = Infinity;
                                
                                for (let k = 0; k < hitPointsP.length; k++) {
                                    var distance = dist(vc.x, vc.y, hitPointsP[k].x, hitPointsP[k].y);
                                    if (distance < closestDistance) {
                                        closestDistance = distance;
                                        closestVector = hitPointsP[k];
                                    }
                                }
                                self.checkAndPush(newResults, closestVector, newResults.length - 1, true);
                                collisions[1]['index'] ++;
                                collisions[2]['index'] ++;
                            }
                            
                            if(hitPointsN.length > 0){
                                var closestVector;
                                var closestDistance = Infinity;
                                for (let k = 0; k < hitPointsN.length; k++) {
                                    var distance = dist(vc.x, vc.y, hitPointsN[k].x, hitPointsN[k].y);
                                    if (distance < closestDistance) {
                                        closestDistance = distance;
                                        closestVector = hitPointsN[k];
                                    }
                                }
                                self.checkAndPush(newResults, closestVector, newResults.length , true);
                                collisions[3]['index'] ++;
                            }

                        }

                        results = newResults;
                        var tile01 = results.slice(collisions[0]['index'], collisions[2]['index']);
                        var tile02 = results.slice(collisions[2]['index'], results.length).concat(results.slice(0, collisions[0]['index']));
    
                        // var tile = self.#createTile(tile01, isDummy);
                        // var bb = tile.getBoundingBox();
                        // if (bb.h > 0 && bb.w > 0) {
                        //     self.#tiles.push(tile);
                        // }
                        extraTile = Vector2.copyAll(tile01);
                        results = Vector2.copyAll(tile02);
                    }  
                    else {
                        var tile01 = results.slice(collisions[0]['index'], collisions[2]['index']);
                        var tile02 = results.slice(collisions[2]['index'], results.length).concat(results.slice(0, collisions[0]['index']));
    
                        // var tile = self.#createTile(tile01, isDummy);
                        // var bb = tile.getBoundingBox();
                        // if (bb.h > 0 && bb.w > 0) {
                        //     self.#tiles.push(tile);
                        // }
                        extraTile = Vector2.copyAll(tile01);
                        results = Vector2.copyAll(tile02);
                    }
                }
                //add point inside tile
                else if(collisions.length == 2){
                    var index = collisions[0]['index'];
                    for (let r = 0; r < insetPoints.length; r++) {
                        const insetPoint = insetPoints[r];
                        if (self.IsInside(predictionPoints, insetPoint.x, insetPoint.y, false)) {
                            results.splice(index, 0, insetPoint);
                        }
                    }
                    for (let x = 0; x < outsets.length; x++) {
                        const outsetPoints = outsets[x].getVertices();

                        for (let r = 0; r < outsetPoints.length; r++) {
                            const outsetPoint = outsetPoints[r];
                            if (self.IsInside(predictionPoints, outsetPoint.x, outsetPoint.y, false)) {
                                results.splice(index, 0, outsetPoint);
                            }
                        }
                    }
                }
      
                predictionPoints = Vector2.copyAll(results);
                
                // //PHASE 01: Move all the points to valid locations
                // var tmp = Vector2.copyAll(predictionPoints);
                // for (let i = 0; i < predictionPoints.length; i++) {
                //     const vp = predictionPoints[i - 1 >= 0 ? i - 1 : predictionPoints.length - 1];
                //     const vc = predictionPoints[i];
                //     const vn = predictionPoints[i + 1 <= predictionPoints.length - 1 ? i + 1 : 0];

                //     //If point is invalid
                //     if (!self.IsInside(insetPoints, vc.x, vc.y) || self.IsInsideForbiddenShapes(outsets, vc.x, vc.y)) {

                //         var dirPrev = vc.getCopy().remove(vp).normalized();
                //         var raycastPrev = self.#raycast([inset].concat(outsets), vc, dirPrev, tileSize.x, false);

                //         var dirNext = vc.getCopy().remove(vn).normalized();
                //         var raycastNext = self.#raycast([inset].concat(outsets), vc, dirNext, tileSize.x, false);

                //         //Has collision with previous
                //         if (raycastPrev != null) {
                //             tmp[i] = raycastPrev;
                //             isDummy = true;
                //         }
                //         //Has no collision
                //         if (raycastPrev == null && raycastNext == null) {
                //             isDummy = true;
                //             self.#buffer.text("X", vc.x, vc.y);
                //             tmp.splice(i, 1);

                //             for (let r = 0; r < insetPoints.length; r++) {
                //                 const insetPoint = insetPoints[r];
                //                 if (self.IsInside(predictionPoints, insetPoint.x, insetPoint.y)) {
                //                     tmp.splice(i, 0, insetPoint);
                //                 }
                //             }
                //         }

                //         if ((raycastNext != null || raycastPrev != null) && !(raycastNext != null && raycastPrev != null)) {
                //             for (let x = 0; x < outsets.length; x++) {
                //                 const outsetPoints = outsets[x].getVertices();

                //                 for (let r = 0; r < outsetPoints.length; r++) {
                //                     const outsetPoint = outsetPoints[r];
                //                     if (self.IsInside(predictionPoints, outsetPoint.x, outsetPoint.y)) {
                //                         tmp.splice(i, 0, outsetPoint);
                //                     }
                //                 }
                //             }
                //         }

                //         //Has collision with next
                //         if (raycastNext != null) {
                //             isDummy = true;
                //             tmp[i] = raycastNext;
                //         }
                //     }
                // }
                // predictionPoints = Vector2.copyAll(tmp);

                // for (let i = 0; i < predictionPoints.length; i++) {
                //     const vc = predictionPoints[i];
                //     if (!hideVisuals) { self.#buffer.fill(0); self.#buffer.circle(vc.x, vc.y, 10); }
                // }


                // create tile
                var tile = self.#createTile(predictionPoints, isDummy);
                var extra = null;

                var bb = tile.getBoundingBox();
                if (bb.h <= 0 || bb.w <= 0) {
                    tile = null;
                }

                if(extraTile != null){
                    extra = self.#createTile(extraTile, isDummy);
                    var extraBb = extra.getBoundingBox();
                    if (extraBb.h <= 0 || extraBb.w <= 0) {
                        extra = null;
                    }
                }
                resolve([tile, extra]);
            }, delay);
        });

        var tmpTiles = [];
        var loop = async (x, y, w, h) => {
            var predictedPoints = [new Vector2(x, y), new Vector2(x + w, y), new Vector2(x + w, y + h), new Vector2(x, y + h)];
            if(Collision.polygonPolygon(insetPoints, predictedPoints)){
                await syncedPlaceTile(x, y, predictedPoints).then(tiles =>{
                    tmpTiles[x + "_" + y] = tiles;
                });
                await self.#sleep(100);
                if(tmpTiles[x + "_" + y][0] != null || tmpTiles[x + "_" + y][1] != null){
                    //Neighbour left
                    if(typeof tmpTiles[(x - w) + "_" + y] === "undefined"){
                        await loop(x - w, y, w, h);
                    }
                    //Neighbour right
                    if(typeof tmpTiles[(x + w) + "_" + y] === "undefined"){
                        await loop(x + w, y, w, h);
                    }
                    //Neighbour up
                    if(typeof tmpTiles[x + "_" + (y - h)] === "undefined"){
                        await loop(x, y - h, w, h);
                    }
                    //Neighbour down
                    if(typeof tmpTiles[x + "_" + (y + h)] === "undefined"){
                        await loop(x, y + h, w, h);
                    }
                }
            }
        };

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
            // else if(topleft.y >= vc.y && topleft.x >= vc.x){
            //     topleft = vc;
            // }
        }

        //center
        await loop(topleft.x + self.offsetX, topleft.y + self.offsetY, tileSize.x, tileSize.y);
        
        console.log(this.#tiles);
        if(this.debugStartingPoint){
            this.#buffer.fill(255, 0, 0);
            this.#buffer.circle(topleft.x + self.offsetX, topleft.y + self.offsetY, 10);
        }
    }

    #convertToGrid(value, gridStart, gridSize, useRound = true) {
        if (useRound) {
            return Math.round((value - gridStart) / gridSize) * gridSize + gridStart;
        }
        else {
            return Math.floor((value - gridStart) / gridSize) * gridSize + gridStart;
        }
    }

    #createTile(vertices, isDummy) {
        return new Tile(vertices, this.#buffer, isDummy);
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

    toJSON() {
        var t = { 'Alucobond': [], 'X-Roof': [], 'Ventilatiekap': [] };

        for (let i = 0; i < this.#tiles.length; i++) {
            const tile = this.#tiles[i];

            if (tile.isDummy) {
                t['Alucobond'].push(tile.toJSON());
                this.#totalWidth += tile.width;
                this.#totalHeight += tile.height;
                this.#dummyWidth += tile.width;
                this.#dummyHeight += tile.height;
            }
            else if (tile.isVent) {
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

        // for (let i = 0; i < this.#tiles['Alucobond'].length; i++) {
        //     const tile = this.#tiles['Alucobond'][i];
        //     t['Alucobond'].push(tile.toJSON());
        // }

        // for (let i = 0; i < this.#tiles['X-Roof'].length; i++) {
        //     const tile = this.#tiles['X-Roof'][i];
        //     t['X-Roof'].push(tile.toJSON());
        // }

        return { 'tiles': t, 'width': this.#totalWidth, 'height': this.#totalHeight, 'tile_width': this.#tileWidth, 'tile_height': this.#tileHeight, 'dummy_width': this.#dummyWidth, 'dummy_height': this.#dummyHeight };
    }

    fromJSON(json) {
        if (!json) { return; }

        if (json.tiles) {
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
        }

        if (json.width) { this.#totalWidth = json.width; }
        if (json.height) { this.#totalHeight = json.height; }

        if (json.dummy_width) { this.#dummyWidth = json.dummy_width; }
        if (json.dummy_height) { this.#dummyHeight = json.dummy_height; }

        if (json.tile_width) { this.#tileWidth = json.tile_width; }
        if (json.tile_height) { this.#tileHeight = json.tile_height; }
    }

    IsInside(vertices, x, y, includeLines = true) {
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

        // if (Collision.polygonPoint(vertices, x, y)) {
        //     return true;
        // }

        // for (let i = 0; i < vertices.length; i++) {
        //     const vc = vertices[i];
        //     const vn = vertices[i + 1 < vertices.length - 1 ? i + 1 : 0];

        //     if (Collision.linePoint(vc.x, vc.y, vn.x, vn.y, x, y)) {
        //         if (y == 406.91537822811176 && x == 1907.2847231827582) {
        //             console.log("Inside");
        //         }
        //         return true;
        //     }
        // }

        // return false;
    }

    IsInsideForbiddenShapes(forbiddenShapes, x, y) {
        var isInside = false;
        for (let i = 0; i < forbiddenShapes.length; i++) {
            const shape = forbiddenShapes[i];
            const shapePoints = shape.getVertices();
            if (this.IsInside(shapePoints, x, y)) {
                isInside = true;
            }
        }

        return isInside;
    }

    checkAndPush(arr, vector2, index, useIndex = false) {
        var found = false;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].x === vector2.x && arr[i].y === vector2.y) {
                found = true;
                break;
            }
        }
        if (!found) {
            if(useIndex) arr.splice(index, 0, vector2);
            else arr.push(vector2);
        }
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

        // if (xCoor < Math.min(pointA.x, pointB.x) || xCoor > Math.max(pointA.x, pointB.x) ||
        //     xCoor < Math.min(pointC.x, pointD.x) || xCoor > Math.max(pointC.x, pointD.x)) {
        //     return null;
        // }
        // if (yCoor < Math.min(pointA.y, pointB.y) || yCoor > Math.max(pointA.y, pointB.y) ||
        //     yCoor < Math.min(pointC.y, pointD.y) || yCoor > Math.max(pointC.y, pointD.y)) {
        //     return null;
        // }

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

    isCollidingWithShapes(shapes, shape) {
        for (let i = 0; i < shapes.length; i++) {
            const points = shapes[i].getVertices();

            if (Collision.polygonPolygon(points, shape)) {
                return true;
            }
        }

        return false;
    }

    reorderClockwise(points) {
        let midpoint = createVector(0, 0);
        for (let i = 0; i < points.length; i++) {
            midpoint.x += points[i].x;
            midpoint.y += points[i].y;
        }
        midpoint.x /= points.length;
        midpoint.y /= points.length;

        
        points.sort((a, b) => {
            let angleA = atan2(a.y - midpoint.y, a.x - midpoint.x);
            let angleB = atan2(b.y - midpoint.y, b.x - midpoint.x);
            return angleA - angleB;
        });
        return points;
        // Returns points with 0 always being top left
        // let upperLeftIndex = 0;
        // for (let i = 1; i < points.length; i++) {
        //     if (points[i].y < points[upperLeftIndex].y ||
        //         (points[i].y == points[upperLeftIndex].y && points[i].x < points[upperLeftIndex].x)) {
        //     upperLeftIndex = i;
        //     }
        // }

        // let rotatedPoints = [];
        // for (let i = upperLeftIndex; i < points.length; i++) {
        //     rotatedPoints.push(points[i]);
        // }
        // for (let i = 0; i < upperLeftIndex; i++) {
        //     rotatedPoints.push(points[i]);
        // }

        // return rotatedPoints;
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