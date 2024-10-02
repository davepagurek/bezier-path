import { BezierPath, DrawingCommand } from ".";
import { BezierSegment } from "./BezierSegment";
import { BezierControlPoint } from "./types";

// https://stackoverflow.com/questions/64945219/split-a-svg-path-d-to-array-of-objects
const PATH_COMMANDS = {
  M: ["x", "y"],
  m: ["dx", "dy"],
  H: ["x"],
  h: ["dx"],
  V: ["y"],
  v: ["dy"],
  L: ["x", "y"],
  l: ["dx", "dy"],
  Z: [],
  C: ["x1", "y1", "x2", "y2", "x", "y"],
  c: ["dx1", "dy1", "dx2", "dy2", "dx", "dy"],
  S: ["x2", "y2", "x", "y"],
  s: ["dx2", "dy2", "dx", "dy"],
  Q: ["x1", "y1", "x", "y"],
  q: ["dx1", "dy1", "dx", "dy"],
  T: ["x", "y"],
  t: ["dx", "dy"],
  A: ["rx", "ry", "rotation", "large-arc", "sweep", "x", "y"],
  a: ["rx", "ry", "rotation", "large-arc", "sweep", "dx", "dy"]
};

function fromPathToArray(path: string): DrawingCommand[] {
  const items = path.replace(/[\n\r]/g, '').
                replace(/-/g, ' -').
                replace(/(\d*\.)(\d+)(?=\.)/g, '$1$2 ').
                replace(/(\d)([A-Za-z])/g, '$1 $2').
                replace(/([A-Za-z])(\d)/g, '$1 $2').
                trim().
                split(/\s*,|\s+/)
  const segments: DrawingCommand[] = [];
  let currentCommand: string = '';
  let currentElement = {};
  while (items.length > 0){
    let it = items.shift()!;
    if (PATH_COMMANDS.hasOwnProperty(it)){
      currentCommand = it;
    }
    else{
      items.unshift(it);
    }
    currentElement = {type: currentCommand};
    PATH_COMMANDS[currentCommand].forEach((prop) => {
      it = items.shift()!;  // TODO sanity check
      currentElement[prop] = parseFloat(it);
    });
    if (currentCommand === 'M'){
      currentCommand = 'L';
    }
    else if (currentCommand === 'm'){
      currentCommand = 'l';
    }
    segments.push(currentElement as any);
  }
  return segments
}

export const createFromPath = (el: SVGPathElement) => {
  const commands = fromPathToArray(el.getAttribute('d')!)
  if (commands.length < 2) {
    throw new Error(`Path doesn't have enough commands: ${JSON.stringify(commands)}`)
  }
  if (commands[0].type !== 'M') {
    throw new Error(`Path starts with ${commands[0].type} instead of M!`)
  }
  let lastPoint = { x: commands[0].x, y: commands[0].y }
  commands.shift()
  const segments: BezierSegment[] = []
  while (commands.length > 0) {
    const command = commands.shift()!
    if (command.type === 'C') {
      segments.push(new BezierSegment(
        lastPoint,
        { x: command.x1, y: command.y1 },
        { x: command.x2, y: command.y2 },
        { x: command.x, y: command.y }
      ))
      lastPoint = { x: command.x, y: command.y }
    } else if (command.type === 'L') {
      segments.push(new BezierSegment(
        lastPoint,
        lastPoint,
        { x: command.x, y: command.y },
        { x: command.x, y: command.y }
      ))
      lastPoint = { x: command.x, y: command.y }
		} else if (command.type === 'H') {
      segments.push(new BezierSegment(
        lastPoint,
        lastPoint,
        { x: command.x, y: lastPoint.y },
        { x: command.x, y: lastPoint.y }
      ))
      lastPoint = { x: command.x, y: lastPoint.y }
		} else if (command.type === 'V') {
      segments.push(new BezierSegment(
        lastPoint,
        lastPoint,
        { x: lastPoint.x, y: command.y },
        { x: lastPoint.x, y: command.y }
      ))
      lastPoint = { x: lastPoint.x, y: command.y }
    } else if (command.type === 'Z') {
      // noop
    } else {
      throw new Error(`Unsupported path command ${command.type}; use only H, V, M, L, C, Z!`)
    }
  }
  return new BezierPath(segments)
}

export const createFromLine = (el: SVGLineElement) => {
  const [x1, x2, y1, y2] = ['x1', 'x2', 'y1', 'y2']
    .map((prop) => parseFloat(el.getAttribute(prop) || '0'))
  
  return new BezierPath([
    new BezierSegment(
      { x: x1, y: y1 },
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      { x: x2, y: y2 }
    )
  ])
}

export const createFromCircle = (el: SVGCircleElement) => {
  const [cx, cy, r] = ['cx', 'cy', 'r']
    .map((prop) => parseFloat(el.getAttribute(prop) || '0'))
  
  const k = 1.3
  return new BezierPath([
    new BezierSegment(
      { x: cx - r, y: cy },
      { x: cx - r, y: cy - k*r },
      { x: cx + r, y: cy - k*r },
      { x: cx + r, y: cy }
    ),
    new BezierSegment(
      { x: cx + r, y: cy },
      { x: cx + r, y: cy + k*r },
      { x: cx - r, y: cy + k*r },
      { x: cx - r, y: cy }
    ),
  ])
}

export const createFromElement = (el: SVGElement) => {
  const tag = el.tagName.toLowerCase()
  if (tag === 'path') {
    return createFromPath(el as SVGPathElement)
  } else if (tag === 'line') {
    return createFromLine(el as SVGLineElement)
  } else if (tag === 'circle') {
    return createFromCircle(el as SVGCircleElement)
  } else {
    throw new Error(`Unsupported SVG tag: ${tag}`)
  }
}

export const create = (points: BezierControlPoint[]) => {
  const segments: BezierSegment[] = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    segments.push(
      new BezierSegment(
        prev.pt,
        prev.right || prev.pt,
        curr.left || curr.pt,
        curr.pt,
      ),
    )
  }
  return new BezierPath(segments)
}

export const createFromCommands = (rawCommands: DrawingCommand[]) => {
  const commands = rawCommands.slice()
  if (commands.length < 2) {
    throw new Error(
      `Path doesn't have enough commands: ${JSON.stringify(commands)}`,
    )
  }
  if (commands[0].type !== 'M') {
    throw new Error(`Path starts with ${commands[0].type} instead of M!`)
  }
  let lastPoint = { x: commands[0].x, y: commands[0].y }
  let firstPoint = { ...lastPoint }
  const segments: BezierSegment[] = []
  while (commands.length > 0) {
    const command = commands.shift()!
    if (command.type === 'M') {
      firstPoint = {
        x: command.x,
        y: command.y,
      }
      lastPoint = firstPoint
    } else if (command.type === 'C') {
      segments.push(
        new BezierSegment(
          lastPoint,
          { x: command.x1, y: command.y1 },
          { x: command.x2, y: command.y2 },
          { x: command.x, y: command.y },
        ),
      )
      lastPoint = { x: command.x, y: command.y }
    } else if (command.type === 'L') {
      if (command.x !== lastPoint.x || command.y !== lastPoint.y) {
        segments.push(
          new BezierSegment(
            lastPoint,
            lastPoint,
            { x: command.x, y: command.y },
            { x: command.x, y: command.y },
          ),
        )
      }
      lastPoint = { x: command.x, y: command.y }
    } else if (command.type === 'H') {
      if (command.x !== lastPoint.x) {
        segments.push(
          new BezierSegment(
            lastPoint,
            lastPoint,
            { x: command.x, y: lastPoint.y },
            { x: command.x, y: lastPoint.y },
          ),
        )
      }
      lastPoint = { x: command.x, y: lastPoint.y }
    } else if (command.type === 'V') {
      if (command.y !== lastPoint.y) {
        segments.push(
          new BezierSegment(
            lastPoint,
            lastPoint,
            { x: lastPoint.x, y: command.y },
            { x: lastPoint.x, y: command.y },
          ),
        )
      }
      lastPoint = { x: lastPoint.x, y: command.y }
    } else if (command.type === 'Q') {
      segments.push(
        new BezierSegment(
          lastPoint,
          {
            x: lastPoint.x + (2 / 3) * (command.x1 - lastPoint.x),
            y: lastPoint.y + (2 / 3) * (command.y1 - lastPoint.y),
          },
          {
            x: command.x + (2 / 3) * (command.x1 - command.x),
            y: command.y + (2 / 3) * (command.y1 - command.y),
          },
          { x: command.x, y: command.y },
        ),
      )
      lastPoint = { x: command.x, y: command.y }
    } else if (command.type === 'Z') {
      if (
        Math.hypot(lastPoint.x - firstPoint.x, lastPoint.y - firstPoint.y) > 0
      ) {
        segments.push(
          new BezierSegment(lastPoint, lastPoint, firstPoint, firstPoint),
        )
      }
    } else {
      throw new Error(
        // @ts-ignore
        `Unsupported path command ${command.type}; use only H, V, M, L, C, Z!`,
      )
    }
  }
  return new BezierPath(segments)
}
