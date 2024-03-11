export default class JarvisAlgorithm{
    static calculate(points){
        let index = 2;
        let nextIndex = -1;
        let hull = [];
        let mostLeft, current, next;

        mostLeft = points[0];
        current = mostLeft;
        next = points[1];
        hull.push(current);

        var loop = true;
        while(loop){
            var checking = points[index];
            const a = p5.Vector.sub(next, current);
            const b = p5.Vector.sub(checking, current);
            const cross = a.cross(b);
            
            if(cross.z < 0){
                next = checking;
                nextIndex = index;
            }
            
            index++;
            if(index == points.length){
                if(next == mostLeft){
                    loop = false;
                }
                hull.push(next);
                current = next;
                index = 0;
                points.splice(nextIndex, 1);
                next = mostLeft;
            }
        }
        return hull;
    }
}