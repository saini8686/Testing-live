const HAPPY_SPRING_SIZE = 5;
const FORCE_LIMIT = .03;
const VELOCITY_LIMIT = .2;

class SVG {
    constructor() {
        this.svg = c('svg', {
            viewBox: `0 0 100 100`
        });
        this.svg.style.outline = '1px solid red';
        document.body.appendChild(this.svg);
    }

    add(domEl) {
        this.svg.appendChild(domEl);
    }

    remove(domEl) {
        this.svg.removeChild(domEl);
    }
}



function easeOutQuart(x) {
    return 1 - (1 - x) ** 4;
}


function rainbowColor(x) {
    const m = (1 - x) * 5;
    const slice = Math.floor(m)
    const p = m - slice;
    switch (slice) {
        case 0:
            return `rgb(255, ${p*255}, 0)`;
        case 1:
            return `rgb(${(1-p)*255}, 255, 0)`;
        case 2:
            return `rgb(0, 255, ${p*255})`;
        case 3:
            return `rgb(0, ${(1-p)*255}, 255)`;
        case 4:
            return `rgb(${p*255}, 0, 255)`;
        case 5:
            return `rgb(255, 0, ${(1-p)*255})`;
    }
}


///////////////////////////////////
function l(idx) {
    return idx * 2 + 1;
}

function r(idx) {
    return idx * 2 + 2;
}

function p(idx) {
    return Math.floor((idx - 1) / 2)
}

class Heap {
    constructor() {
        this.arr = [];
    }

    insert(el) {
        this.arr.push(el);
        let pos = this.arr.length - 1;
        while (pos > 0 && this.arr[p(pos)] < el) {
            [this.arr[pos], this.arr[p(pos)]] = [this.arr[p(pos)], this.arr[pos]];
            pos = p(pos);
        }
    }

    extract() {
        const el = this.arr[0];

        if (this.arr.length <= 1) {
            this.arr = [];
            return el;
        }

        this.arr[0] = this.arr.pop();
        let pos = 0;


        while (pos < this.arr.length) {
            let bestIdx = null;

            const self = this.arr[pos]
            const left = this.arr[l(pos)];
            const right = this.arr[r(pos)];

            const opts = [self, left, right];

            opts.forEach((opt, i) => {
                if (opt == null) return;

                if (bestIdx == null || opts[bestIdx] < opt) {
                    bestIdx = i;
                }
            })

            if (bestIdx === 0)
                // self is highest, done fixing heap
                break;

            if (bestIdx === 1) {
                // left is highest, swap and iterate left
                [this.arr[pos], this.arr[l(pos)]] = [this.arr[l(pos)], this.arr[pos]];
                pos = l(pos);

            } else {
                // right is highest, swap and iterate right
                [this.arr[pos], this.arr[r(pos)]] = [this.arr[r(pos)], this.arr[pos]];
                pos = r(pos);
            }
        }
        return el;
    }

}





//////////////////////////////////////////////
function c(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) update(el, attrs);
    return el;
}

function update(el, attrs) {
    Object.keys(attrs).forEach(k => {
        el.setAttribute(k, attrs[k]);
    })
}

function animate(stepFn, duration, ease = x => x) {
    const start = Date.now();

    return new Promise(resolve => {
        function _animate() {
            const t = Math.min((Date.now() - start) / duration, 1);

            stepFn(ease(t));

            if (t === 1) {
                resolve();
            } else {
                requestAnimationFrame(_animate);
            }
        }

        _animate();
    })
}




class Vec2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}


class Point {
    constructor([x, y]) {
        this.pos = new Vec2(x, y);
        this.accel = new Vec2(0, 0);
        this.vel = new Vec2(0, 0);

        this.subscriptions = new Set();
    }

    get x() {
        return this.pos.x;
    }

    get y() {
        return this.pos.y;
    }

    set([x, y]) {
        this.pos = new Vec2(x, y);
        this.subscriptions.forEach(s => s([x, y]));
    }

    subscribe(s) {
        s([this.pos.x, this.pos.y]);
        this.subscriptions.add(s)
    }

    unsubscribe(s) {
        return this.subscriptions.delete(s);
    }

    clone() {
        return new Point([this.pos.x, this.pos.y]);
    }
}

function lerpPos(a, b) {
    return function (t) {
        return new Point([
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t,
        ])
    }
}


class DOMHeapConnection {
    constructor(parent, child, rootNode) {

        this.rootNode = rootNode;

        this.node = c('line', {
            stroke: 'black',
        });

        rootNode.appendChild(this.node);

        this.p1Sub = null;
        this.p2Sub = null;

        this.p1 = null;
        this.p2 = null;

        this.setP1(parent);
        this.setP2(child);

        this.swap = this.swap.bind(this);
        this.IS_DESTROYED = false;
    }


    updateSwappedConnections() {
        const p1Conns = Array.from(this.p1.connections.values());
        const p2Conns = Array.from(this.p2.connections.values());

        const f = (node) => node !== this.p1 && node !== this.p2;

        const p1Nodes = Array.from(this.p1.connections.keys()).filter(f);
        const p2Nodes = Array.from(this.p2.connections.keys()).filter(f);

        p1Conns.forEach(conn => conn.destroy());
        p2Conns.forEach(conn => conn.destroy());

        this.p1.connections = new Map();
        this.p2.connections = new Map();

        p1Nodes.forEach(n => n.connect(this.p2));
        p2Nodes.forEach(n => n.connect(this.p1));
        this.p1.connect(this.p2);
    }

    swap() {
        const pos1 = this.p1.location.clone();
        const pos2 = this.p2.location.clone();

        const lerpA = (t) => {
            const newPos = lerpPos(pos1, pos2)(t);
            this.p1.updateLocation([newPos.x, newPos.y]);
        };

        const lerpB = (t) => {
            const newPos = lerpPos(pos2, pos1)(t);
            this.p2.updateLocation([newPos.x, newPos.y]);
        };

        const scheduledSwap = (() => {
            let prevT = 0;
            return (t) => {
                const p = prevT;
                prevT = t;

                if (!(p < .5 && t >= .5)) return
                this.updateSwappedConnections();
            }
        })();

        const stepFn = (t) => {
            lerpA(t);
            lerpB(t);
            scheduledSwap(t);
        };

        return animate(stepFn, 200, easeOutQuart)
    }

    setColor() {
        if (!this.p1 || !this.p2) return;
        const value = (this.p1.value + this.p2.value) / 2;
        const color = rainbowColor(value);
        this.node.setAttribute('stroke', color);
    }

    setP1(node) {
        if (this.p1) throw new Error('Parent exists');

        this.p1 = node;
        const updater = ([x, y]) => {
            update(this.node, {
                x1: x,
                y1: y,
            })
        }

        this.setColor();

        this.p1Sub = updater;
        node.location.subscribe(updater);
    }

    setP2(node) {
        if (this.p2) throw new Error('Child exists');

        this.p2 = node;
        const updater = ([x, y]) => {
            update(this.node, {
                x2: x,
                y2: y,
            })
        }

        this.setColor();

        this.p2Sub = updater;
        node.location.subscribe(updater);
    }

    destroy() {
        if (this.IS_DESTROYED) return;

        this.p1.location.unsubscribe(this.p1Sub);
        this.p2.location.unsubscribe(this.p2Sub);

        this.p1.connections.delete(this.p2);
        this.p2.connections.delete(this.p1);

        this.rootNode.removeChild(this.node);
        this.IS_DESTROYED = true;
    }
}


function sMult(a, vec) {
    return new Vec2(a * vec.x, a * vec.y);
}

function vAdd(v1, v2) {
    return new Vec2(v1.x + v2.x, v1.y + v2.y);
}

function vSub(v1, v2) {
    return vAdd(v1, sMult(-1, v2));
}

function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

class DOMHeapNode {
    constructor({
        nodeContainer,
        connContainer,
        value,
        allNodes,
        id
    }) {
        this.id = id;
        this.allNodes = allNodes || [];
        this.nodeContainer = nodeContainer;
        this.connContainer = connContainer;

        this.value = value;

        this.idx = null;

        this.node = c('circle', {
            r: 1,
            cx: 0,
            cy: 0,
            fill: rainbowColor(value),
            stroke: 'transparent'
        });

        this.location = null;
        this._setLocation([0, 0]);

        this.nodeContainer.appendChild(this.node);
        this.connections = new Map();

        this.node.addEventListener('click', () => {
            console.log(this.connections)
        })

        this.IS_PINNED = false;
    }

    pin() {
        this.IS_PINNED = true;
    }

    unpin() {
        this.IS_PINNED = false;
    }

    lateUpdate() {
        if (!this.nextLocation) return;
        this.updateLocation(this.nextLocation);
    }

    update() {
        if (this.IS_PINNED) return;

        let accel = this.allNodes.map(node => {
            if (node === this) return new Vec2(0, 0);

            const p1 = this.location.pos;
            const p2 = node.location.pos;
            const d = dist(p1, p2);
            if (d === 0) return new Vec2(0, 0);

            let unitVec = vSub(p2, p1);
            unitVec = sMult(
                1 / dist(new Vec2(0, 0), unitVec),
                unitVec
            );

            // these nodes are connected; apply spring force
            if (this.connections.get(node)) {
                const springForce = (d - HAPPY_SPRING_SIZE) * .1;
                return sMult(springForce, unitVec);
            }

            // these nodes are not connected, apply magnetic repulsion
            const electricForce = Math.min(-.6 / d ** 2, .05);

            return sMult(electricForce, unitVec);
        }).reduce((a, b) => vAdd(a, b), new Vec2(0, -.04));

        const accelMag = dist(accel, new Vec2(0, 0));
        if (accelMag > FORCE_LIMIT) {
            accel = sMult(FORCE_LIMIT / accelMag, accel);
        }


        this.location.vel = vAdd(this.location.vel, accel);
        this.location.vel = sMult(.8, this.location.vel);

        const velMag = dist(new Vec2(0, 0), this.location.vel);
        if (velMag > VELOCITY_LIMIT) {
            this.location.vel = sMult(VELOCITY_LIMIT / velMag, this.location.vel)
        }

        this.nextLocation = [
            this.location.x + this.location.vel.x,
            this.location.y + this.location.vel.y,
        ];

    }

    updateLocation([x, y]) {
        this.location.set([x, y]);
        this.nextLocation = [x, y];
    }

    _setLocation([x, y]) {
        this.location = new Point([x, y]);

        this.location.subscribe(([x, y]) => {
            update(this.node, {
                cx: x,
                cy: y
            })
        })
    }

    disconnect(node) {
        const conn = this.connections.get(node);
        if (!conn) throw new Error('Not connected');

        this.connections.delete(node);
        conn.destroy();
    }

    connect(node) {
        if (this.connections.get(node) || node.connections.get(this)) {
            return;
        }

        const conn = new DOMHeapConnection(this, node, this.connContainer);
        this.connections.set(node, conn);
        node.connections.set(this, conn);
    }

}

function style(el, style) {
    Object.assign(el.style, style);
}


function styledSvg() {
    const svg = c('svg', {
        viewBox: '0 0 100 100',
    });

    style(svg, {
        display: 'block',
        maxHeight: '100%',
        maxWidth: '100%',
    });

    return svg;
}


class DOMHeap {
    constructor() {
        this.nodeArr = [];

        this.rootNode = styledSvg();
        this.connContainer = c('g');
        this.nodeContainer = c('g');


        document.body.appendChild(this.rootNode);
        this.rootNode.appendChild(this.connContainer);
        this.rootNode.appendChild(this.nodeContainer);

        this.animationQueue = Promise.resolve();

        this.rootPos = new Point([50, 0]);
    }


    async push(value) {
        const node = new DOMHeapNode({
            nodeContainer: this.nodeContainer,
            connContainer: this.connContainer,
            allNodes: this.nodeArr,
            value,
            id: DOMHeap.nodeId++,
        });
        this.nodeArr.push(node);

        const nodeIdx = this.nodeArr.length - 1;

        if (nodeIdx === 0) {
            node.updateLocation([50, 95]);
            node.pin();
        } else {
            const parent = this.nodeArr[p(nodeIdx)];
            const parentLoc = parent.location.pos;

            const randRotation = Math.random() * 2 * Math.PI;
            const offset = new Vec2(
                HAPPY_SPRING_SIZE * Math.cos(randRotation),
                HAPPY_SPRING_SIZE * Math.sin(randRotation)
            );

            const newLoc = vAdd(parentLoc, offset);

            node.updateLocation([newLoc.x, newLoc.y]);
            parent.connect(node);

            await new Promise(r => setTimeout(r, 200));
            return this.fix(nodeIdx);
        }
    }

    async fix(idx) {
        if (idx === 0) return;

        const self = this.nodeArr[idx];
        const parent = this.nodeArr[p(idx)];
        if (self.value < parent.value) return;

        self.pin();
        parent.pin();
        await self.connections.get(parent).swap();
        parent.unpin();
        if (p(idx) !== 0) self.unpin();

        [this.nodeArr[idx], this.nodeArr[p(idx)]] = [this.nodeArr[p(idx)], this.nodeArr[idx]]

        await this.fix(p(idx))
    }

}

DOMHeap.nodeId = 0;




function s() {
    let x0 = 0;
    let x1 = 100;
    let y0 = 0;
    let y1 = 100;

    const heap = new DOMHeap();

    let promise = Promise.resolve();
    const addToPromise = (limit = Infinity) => {
        if (limit === 0) return;
        promise = promise
            .then(() => heap.push(Math.random()))
            .then(() => addToPromise(--limit))
    }

    const button = document.createElement('button');
    button.innerText = 'Insert'
    document.body.appendChild(button);

    button.addEventListener('click', () => {
        promise = promise.then(() => heap.push(Math.random()));
    })

    addToPromise(500)

    function animate() {
        heap.nodeArr.forEach(node => {
            node.update();
        });
        heap.nodeArr.forEach(node => {
            node.lateUpdate();
            if (node.location.x > x1) x1 = node.location.x;
            if (node.location.x < x0) x0 = node.location.x;
            if (node.location.y > y1) y1 = node.location.y;
            if (node.location.y < y0) y0 = node.location.y;

            const PADDING = 10
            const width = Math.max(2 * (50 - x0), 2 * (x1 - 50), 100 - y0, 100) + PADDING;
            heap.rootNode.setAttribute('viewBox', `${50-width/2} ${y0 - PADDING/2} ${width} ${width}`)
        });

        requestAnimationFrame(animate);
    }
    animate();
}

s();