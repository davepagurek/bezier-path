import type { Point } from "./types"
import { times } from "./utils"

export class BezierSegment {
  public A: Point
  public B: Point
  public C: Point
  public D: Point

  constructor(A: Point, B: Point, C: Point, D: Point) {
    this.A = A
    this.B = B
    this.C = C
    this.D = D
  }

  static sampleSpacing() {
    return 2
  }

  tangentAtParameter(parameter: number) {
    const t = Math.max(0, Math.min(1, parameter)) // clamp to [0, 1]

    if (t === 0 || t === 1) {
      let x: number
      let y: number
      if (t === 0) {
        if (this.A.x === this.B.x && this.A.y === this.B.y) {
          x = this.C.x - this.A.x
          y = this.C.y - this.A.y
        } else {
          x = this.B.x - this.A.x
          y = this.B.y - this.A.y
        }
      } else {
        if (this.D.x === this.C.x && this.D.y === this.C.y) {
          x = this.D.x - this.B.x
          y = this.D.y - this.B.y
        } else {
          x = this.D.x - this.C.x
          y = this.D.y - this.C.y
        }
      }
      const hypot = Math.hypot(x, y)
      if (Math.abs(hypot) > 1e-4) {
        x /= hypot
        y /= hypot
      }
      return { x, y }
    }

    const adjustedT = 1 - t
    let x =
      3 * this.D.x * Math.pow(t, 2) -
      3 * this.C.x * Math.pow(t, 2) +
      6 * this.C.x * adjustedT * t -
      6 * this.B.x * adjustedT * t +
      3 * this.B.x * Math.pow(adjustedT, 2) -
      3 * this.A.x * Math.pow(adjustedT, 2)

    let y =
      3 * this.D.y * Math.pow(t, 2) -
      3 * this.C.y * Math.pow(t, 2) +
      6 * this.C.y * adjustedT * t -
      6 * this.B.y * adjustedT * t +
      3 * this.B.y * Math.pow(adjustedT, 2) -
      3 * this.A.y * Math.pow(adjustedT, 2)

    const hypot = Math.hypot(x, y)
    if (Math.abs(hypot) > 1e-4) {
      x /= hypot
      y /= hypot
    }

    return { x, y }
  }

  isLinear() {
    return (
      this.A.x === this.B.x &&
      this.A.y === this.B.y &&
      this.C.x === this.D.x &&
      this.C.y === this.D.y
    )
  }

  pointAtParameter(parameter: number) {
    const t = Math.max(0, Math.min(1, parameter)) // clamp to [0, 1]
    return {
      x:
        Math.pow(1 - t, 3) * this.A.x +
        3 * Math.pow(1 - t, 2) * t * this.B.x +
        3 * (1 - t) * Math.pow(t, 2) * this.C.x +
        Math.pow(t, 3) * this.D.x,
      y:
        Math.pow(1 - t, 3) * this.A.y +
        3 * Math.pow(1 - t, 2) * t * this.B.y +
        3 * (1 - t) * Math.pow(t, 2) * this.C.y +
        Math.pow(t, 3) * this.D.y,
    }
  }

  private _totalLength: number | undefined = undefined
  public getTotalLength(): number {
    if (this._totalLength === undefined) {
      if (this.isLinear()) {
        this._totalLength = Math.hypot(this.D.x - this.A.x, this.D.y - this.A.y)
      } else {
        const initialSamples = Math.max(
          10,
          Math.ceil(
            (Math.hypot(this.B.x - this.A.x, this.B.y - this.A.y) +
              Math.hypot(this.C.x - this.B.x, this.C.y - this.B.y) +
              Math.hypot(this.D.x - this.C.x, this.D.y - this.C.y)) /
              BezierSegment.sampleSpacing(),
          ),
        )
        const pts = times(initialSamples).map((i) =>
          this.pointAtParameter(i / (initialSamples - 1)),
        )
        let total = 0
        for (let i = 1; i < pts.length; i++) {
          total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
        }
        this._totalLength = total
      }
    }

    return this._totalLength
  }
}
