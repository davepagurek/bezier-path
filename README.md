# bezier-path

A library for efficiently querying points along cubic Bezier curves.

## Why?

This implements two features of the native JS `SVGPathElement` API: `path.getTotalLength()`, and `path.getPointAtLength()`, but a lot faster than the native API.

Bezier curves aren't easy to sample by length. Normally, you sample in "Bezier space" for each segment via a number between 0 and 1, but evenly spaced values in Bezier space won't produce evenly spaced points in Cartesian coordinates. Finding a point at a specific distance normally means doing an integration of some kind, which can be slow if you are getting a lot of points. I need it to be fast, though, which is where this library comes in!

## Usage

### Adding the library

Add the library in a script tag:

```html
<script src="https://cdn.jsdelivr.net/npm/@davepagurek/bezier-path@0.0.2"></script>
```

Or on OpenProcessing, add the CDN link as a library:

```
https://cdn.jsdelivr.net/npm/@davepagurek/bezier-path@0.0.2
```

### Creating paths

#### Via the control point API

You can call `create()` with an array of control points. Each control point in an object including a `pt` property, which is the coordinate the curve will pass through. It may optionally include `left` and `right` properties, which control the handles going into and out of the point, respectively.

<table>
<tr>
<td>
  
```js
const myPath = BezierPath.create([
  {
    pt: { x: 10, y: 10 },
    right: { x: 50, y: 10 }
  },
  {
    left: { x: 20, y: 20 },
    pt: { x: 20, y: 30 },
    right: { x: 20, y: 40 }
  },
  {
    left: { x: 50, y: 50 },
    pt: { x: 10, y: 50 },
  },
])
```

</td>
<td>
  
![image](https://github.com/user-attachments/assets/863a837c-b53c-4151-b23f-be804bd726df)

</td>
<td>

![image](https://github.com/user-attachments/assets/a86a9bf1-42ad-4d01-902d-b2c53cc83dde)

</td>
</tr>
</table>

https://editor.p5js.org/davepagurek/sketches/dg2o-sLeK

If you want a fully smooth curve, then the line between a control point's `left` and `right` coordinates must pass through its `pt` coordinate. A way to ensure this is to create just one side, e.g. `right`, and then mirror it for the other side. Here's an example resembling Catmull-Rom interpolation, using p5's `p5.Vector` class for the points:

<table>
<tr>
<td>
  
```js
const pts = []
for (let i = 0; i < 5; i++) {
  pts.push({
    pt: createVector(random(width), random(height))
  })
}

// Smooth tangents
for (let i = 0; i < 5; i++) {
  const prev = pts[i-1]
  const curr = pts[i]
  const next = pts[i+1]
  if (prev && next) {
    // Change the scaling of the tangent to adjust the curve tightness
    const tangent = next.pt.copy().sub(prev.pt).div(4)
    curr.right = curr.pt.copy().add(tangent)
    curr.left = curr.pt.copy().sub(tangent)
  }
}

const myPath = BezierPath.create(pts)
```

</td>
<td>
  
![image](https://github.com/user-attachments/assets/d1b18cbf-436d-46f0-9080-042b1e2b5cec)

</td>
<td>

![image](https://github.com/user-attachments/assets/53e4e1a3-1147-4913-ab54-3ac8fea5e832)

</td>
</tr>
</table>
https://editor.p5js.org/davepagurek/sketches/g2GvhxcNj

#### Via an SVG `<path>` tag

You can also import a path from an SVG embedded in the page:

```js
const myPath = BezierPath.createFromElement(document.querySelector('path'))
```

### Drawing paths

You can draw a path as a polyline by querying points via `getPointAtLength()`:
```js
beginShape()
for (let i = 0; i <= 60; i++) {
  const pt = myPath.getPointAtLength(
    map(i, 0, 60, 0, myPath.getTotalLength())
  )
  vertex(pt.x, pt.y)
}
endShape()
```

Typically, you'll want to vary the number of sample points based on the length of the curve, e.g.:
```js
beginShape()
const sampleRate = 3 // One point every 3px
const numSamples = ceil(myPath.getTotalLength / sampleRate)
for (let i = 0; i < numSamples; i++) {
  const pt = myPath.getPointAtLength(
    map(i, 0, numSamples-1, 0, myPath.getTotalLength())
  )
  vertex(pt.x, pt.y)
}
endShape()
```

### Morphing paths

As long as you have the same number of sample points per path, you can morph between two paths by lerping each sample point between the two:

<table>
<tr>
<td>

```js
const mix = map(cos(frameCount / 120 * TWO_PI), -1, 1, 0, 1)
const numSamples = ceil(max(path1.getTotalLength(), path2.getTotalLength()) / 3)
beginShape()
for (let i = 0; i < numSamples; i++) {
  const pt1 = path1.getPointAtLength(
    map(i, 0, numSamples-1, 0, path1.getTotalLength())
  )
  const pt2 = path2.getPointAtLength(
    map(i, 0, numSamples-1, 0, path2.getTotalLength())
  )
  vertex(lerp(pt1.x, pt2.x, mix), lerp(pt1.y, pt2.y, mix))
}
endShape()
```

</td>
<td>

![morph](https://github.com/user-attachments/assets/7a97ff41-0ec3-42a9-ad43-afa37d98e4d6)

</td>
</tr>
</table>

https://editor.p5js.org/davepagurek/sketches/XvC5H7Zhi

### Full API

#### `BezierPath`
A full path made of a number of segments.

- `getTotalLength(): number`
  - Returns the total length of the path
- `getPointAtLength(length: number, approximate: boolean = false): Point`
  - Returns a coordinate at the given length on the path
  - Specifying `true` for `approximate` will use linear interpolation between internal sample points. This will be faster, but will result in a more segmented line.
- `getTangentAtLength(length: number, approximate: boolean = false): Point`
  - Returns the tangent vector at a given length on the path, normalized to have a length of 1
  - Specifying `true` for `approximate` will use linear interpolation between tangents at internal sample points for faster execution. The result will still be normalized, so this actually will still look pretty good, if not perfectly accurate.
- `getAngleAtLength(length: number, approximate: boolean = false): number`
  - Like `getTangentAtLength`, but it will return the angle of the path in radians
  - This is equivalent to calling `Math.atan2(y, x)` on the tangent vector
