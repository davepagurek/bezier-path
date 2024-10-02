export type Point = { x: number; y: number }

export type BezierControlPoint = {
  left?: Point
  pt: Point
  right?: Point
}

export type DrawingCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'H'; x: number }
  | { type: 'V'; y: number }
  | {
      type: 'C'
      x1: number
      y1: number
      x2: number
      y2: number
      x: number
      y: number
    }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'Z' }
