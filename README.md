# bezier-path

A library for efficiently querying points along Bezier curves.

## Why?

This implements two features of the native JS `SVGPathElement` API: `path.getTotalLength()`, and `path.getPointAtLength()`, but a lot faster than the native API.

Bezier curves aren't easy to sample by length. Normally, you sample in "Bezier space" for each segment via a number between 0 and 1, but evenly spaced values in Bezier space won't produce evenly spaced points in Cartesian coordinates. Finding a point at a specific distance normally means doing an integration of some kind, which can be slow if you are getting a lot of points. I need it to be fast, though, which is where this library comes in!

## Usage

### Adding the library

Add the library in a script tag:

```html
<script src="https://cdn.jsdelivr.net/npm/@davepagurek/bezier-path@0.0.1"></script>
```

Or on OpenProcessing, add the CDN link as a library:

```
https://cdn.jsdelivr.net/npm/@davepagurek/bezier-path@0.0.1
```

### API

```js
// TODO
```
