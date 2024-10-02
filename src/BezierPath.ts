import { BezierSegment } from "./BezierSegment"
import { Point } from "./types"
import { times } from "./utils"

export class BezierPath {
  public segments: BezierSegment[]
  private _totalLength: number

  public samples: {
    dist: number
    pt: Point
    tan: Point
    segIdx: number
    t: number
  }[] = []

  constructor(segments: BezierSegment[]) {
    this.segments = segments

    const segmentLengths = segments.map((s) => s.getTotalLength())
    const segmentOffsets = [0]
    for (let i = 1; i < segmentLengths.length; i++) {
      segmentOffsets.push(segmentOffsets[i - 1] + segmentLengths[i - 1])
    }
    this._totalLength =
      segmentOffsets[segmentOffsets.length - 1] +
      segmentLengths[segmentLengths.length - 1]

    const numSegSamples = (seg: BezierSegment) =>
      Math.max(4, Math.ceil(seg.getTotalLength() / BezierSegment.sampleSpacing()))
    const segmentSamples = segments.map(numSegSamples)
    const numSamples = segmentSamples.reduce((acc, next) => acc + next)
    const stepSize = 1 / numSamples / 10

    const avgDist = this._totalLength / numSamples
    this.samples.push({
      dist: 0,
      pt: this.segments[0].A,
      tan: this.segments[0].tangentAtParameter(0),
      segIdx: 0,
      t: 0,
    })
    segments.forEach((seg, segIdx) => {
      const numSegSamples = segmentSamples[segIdx]

      // Include one extra point at the end at t = 1
      const ts = times(numSegSamples + 1).map((i) => i / numSegSamples)
      const pts = ts.map((t) => seg.pointAtParameter(t))
      let dists: number[]
      for (let it = 0; it < 4; it++) {
        dists = times(numSegSamples).map((i) =>
          Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y),
        )
        const distErrors = dists.map((d) => d - avgDist)
        let offset = 0
        for (let i = 1; i < ts.length - 1; i++) {
          // Shift this t value to get closer to the target length
          offset += distErrors[i - 1]
          ts[i] -= stepSize * offset

          // Sample the point at the new t value
          pts[i] = seg.pointAtParameter(ts[i])
        }
      }

      let lastOffset = 0
      pts.slice(1).forEach((pt, i) => {
        lastOffset += dists[i]
        this.samples.push({
          dist: segmentOffsets[segIdx] + lastOffset,
          pt,
          tan: this.segments[segIdx].tangentAtParameter(ts[i + 1]),
          segIdx,
          t: ts[i + 1],
        })
      })
    })

    this._jumps = []
    this.segmentStartEnds = [{ start: 0, end: 0 }]
    for (let i = 1; i < this.samples.length; i++) {
      const prev = this.samples[i - 1]
      const next = this.samples[i]
      if (next.segIdx === prev.segIdx) {
        this.segmentStartEnds[this.segmentStartEnds.length - 1].end = next.dist
      } else {
        this.segmentStartEnds[next.segIdx] = {
          start: next.dist,
          end: next.dist,
        }
      }
      if (
        prev.segIdx !== next.segIdx &&
        (this.segments[prev.segIdx].D.x !== this.segments[next.segIdx].A.x ||
          this.segments[prev.segIdx].D.y !== this.segments[next.segIdx].A.y)
      ) {
        const midDist = (prev.dist + next.dist) / 2
        const prevEnd = {
          dist: midDist - 1e-8,
          pt: this.segments[prev.segIdx].D,
          tan: this.segments[prev.segIdx].tangentAtParameter(1),
          segIdx: prev.segIdx,
          t: 1,
        }
        const nextStart = {
          dist: midDist + 1e-8,
          pt: this.segments[next.segIdx].A,
          tan: this.segments[next.segIdx].tangentAtParameter(0),
          segIdx: next.segIdx,
          t: 0,
        }
        this._jumps.push(midDist)
        this.samples.splice(i, 0, prevEnd, nextStart)
        i += 2
      }
    }
  }

  public segmentStartEnds: { start: number; end: number }[]

  private _jumps: number[]
  public jumps(): number[] {
    return [...this._jumps]
  }

  public getTotalLength() {
    return this._totalLength
  }

  private findClosestSampleIdx(dist: number) {
    // Binary search to find the sample with the closest dist
    let lo = 0
    let hi = this.samples.length - 1

    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)

      if (this.samples[mid].dist > dist) {
        hi = mid - 1
      } else if (this.samples[mid].dist < dist) {
        lo = mid + 1
      } else {
        return mid
      }
    }

    return Math.max(
      0,
      Math.min(this.samples.length - 1, Math.floor((lo + hi) / 2)),
    )
  }

  public getPointAtLength(length: number, approximate: boolean = false) {
    if (length <= 0) return this.samples[0].pt
    if (length >= this._totalLength)
      return this.samples[this.samples.length - 1].pt

    const idxA = this.findClosestSampleIdx(length)
    const idxB =
      this.samples[idxA].dist < length
        ? Math.min(idxA + 1, this.samples.length - 1)
        : Math.max(0, idxA - 1)
    const mix =
      Math.abs(this.samples[idxB].dist - this.samples[idxA].dist) < 1e-6
        ? 0
        : (length - this.samples[idxA].dist) /
          (this.samples[idxB].dist - this.samples[idxA].dist)

    if (approximate || this.samples[idxA].segIdx > this.samples[idxB].segIdx) {
      // We have a set of evenly spaced samples that are close enough together
      // that we can probably just linearly interpolate between them without
      // too much loss of quality
      const x =
        (1 - mix) * this.samples[idxA].pt.x + mix * this.samples[idxB].pt.x
      const y =
        (1 - mix) * this.samples[idxA].pt.y + mix * this.samples[idxB].pt.y
      return { x, y }
    } else if (this.samples[idxA].segIdx !== this.samples[idxB].segIdx) {
      // Find the t value between the two samples. This is not EXACTLY the point
      // at the target distance along the path, but it's so close that it
      // is effectively the same
      if (mix < 0.5) {
        const segment = this.segments[this.samples[idxA].segIdx]
        const mixA = 2 * mix
        const t = (1 - mixA) * this.samples[idxA].t + mixA
        return segment.pointAtParameter(t)
      } else {
        const segment = this.segments[this.samples[idxB].segIdx]
        const mixB = 2 * (mix - 0.5)
        const t = mixB * this.samples[idxB].t
        return segment.pointAtParameter(t)
      }
    } else {
      const segment = this.segments[this.samples[idxA].segIdx]
      const t = (1 - mix) * this.samples[idxA].t + mix * this.samples[idxB].t
      return segment.pointAtParameter(t)
    }
  }

  public getAngleAtLength(length: number, approximate: boolean = false) {
    const a = this.getTangentAtLength(length, approximate)
    const angle = Math.atan2(a.y, a.x)
    return angle
  }

  public getTangentAtLength(length: number, approximate: boolean = false) {
    if (length <= 0) return this.samples[0].tan
    if (length >= this._totalLength)
      return this.samples[this.samples.length - 1].tan

    const idxA = this.findClosestSampleIdx(length)
    const idxB =
      this.samples[idxA].dist < length
        ? Math.min(idxA + 1, this.samples.length - 1)
        : Math.max(0, idxA - 1)
    const mix =
      (length - this.samples[idxA].dist) /
      (this.samples[idxB].dist - this.samples[idxA].dist)

    if (approximate || this.samples[idxA].segIdx > this.samples[idxB].segIdx) {
      // We have a set of evenly spaced samples that are close enough together
      // that we can probably just linearly interpolate between them without
      // too much loss of quality
      let x =
        (1 - mix) * this.samples[idxA].tan.x + mix * this.samples[idxB].tan.x
      let y =
        (1 - mix) * this.samples[idxA].tan.y + mix * this.samples[idxB].tan.y
      const hypot = Math.max(Math.hypot(x, y), 1e-4)
      x /= hypot
      y /= hypot
      return { x, y }
    } else if (this.samples[idxA].segIdx !== this.samples[idxB].segIdx) {
      // Find the t value between the two samples. This is not EXACTLY the point
      // at the target distance along the path, but it's so close that it
      // is effectively the same
      if (mix < 0.5) {
        const segment = this.segments[this.samples[idxA].segIdx]
        const mixA = 2 * mix
        const t = (1 - mixA) * this.samples[idxA].t + mixA
        return segment.tangentAtParameter(t)
      } else {
        const segment = this.segments[this.samples[idxB].segIdx]
        const mixB = 2 * (mix - 0.5)
        const t = mixB * this.samples[idxB].t
        return segment.tangentAtParameter(t)
      }
    } else {
      const segment = this.segments[this.samples[idxA].segIdx]
      const t = (1 - mix) * this.samples[idxA].t + mix * this.samples[idxB].t
      return segment.tangentAtParameter(t)
    }
  }
}
