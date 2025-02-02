/* globals __line */
var path = require('path')
var createContext = require('../../index')
var utils = require('../common/utils.js')
var utilsLog = require('../common/utils_log.js')
var log = new utilsLog.Log(path.basename(__filename), 'DEBUG')
var bunny = require('bunny')
const normals = require('angle-normals')

// flatten a multi-dimensional array.
// so [[1,2,3], [2,3,4],...] becomes
// [1,2,3, 2,3,4]
function flatten (data) {
  var result = []
  var dimension = data[0].length
  var ptr = 0
  for (var i = 0; i < data.length; ++i) {
    var v = data[i]
    for (var j = 0; j < dimension; ++j) {
      result[ptr++] = v[j]
    }
  }
  return result
}

function main () {
  // Create context
  var width = 512
  var height = 512
  var gl = createContext(width, height, {antialias: true});

  gl.clearColor(0.0, 0.0, 0.0, 1.0)
  gl.enable(gl.DEPTH_TEST)
  gl.enable(gl.CULL_FACE)
  gl.viewport(0, 0, width, height)

  var vertexSrc = `
  precision mediump float;

  attribute vec3 position;
  attribute vec3 normal;

  varying vec3 vNormal;

  uniform mat4 projection, view;
  void main() {
    vNormal = normal;
    gl_Position = projection * view * vec4(position, 1.0);
  }
  `

  var fragmentSrc = `
  precision mediump float;

  varying vec3 vNormal;

  void main () {
    vec3 color = vec3(0.6, 0.0, 0.0);
    vec3 lightDir = vec3(0.39, 0.87, 0.29);
    vec3 ambient = 0.3 * color;
    vec3 diffuse = 0.7 * color * clamp( dot(vNormal, lightDir), 0.0, 1.0 );
    gl_FragColor = vec4(ambient + diffuse, 1.0);
  }
  `

  // setup a GLSL program
  var program = utils.createProgramFromSources(gl, [vertexSrc, fragmentSrc])
  gl.useProgram(program)

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(program, 'position')
  var normalLocation = gl.getAttribLocation(program, 'normal')

  // get uniform locations.
  var projectionUniformLocation = gl.getUniformLocation(program, 'projection')
  var viewUniformLocation = gl.getUniformLocation(program, 'view')

  // setup perspective.
  var perspectiveMatrix = perspective(Math.PI / 4, width / height, 0.01, 1000.0)
  gl.uniformMatrix4fv(projectionUniformLocation, false, new Float32Array(perspectiveMatrix))

  // setup view.
  var m = lookAt([0.0, 12.5, 30.0], [0, 2.5, 0], [0, 1, 0])
  gl.uniformMatrix4fv(viewUniformLocation, false, new Float32Array(m))

  var positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flatten(bunny.positions)), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)

  var normalBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flatten(normals(bunny.cells, bunny.positions))), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(normalLocation)
  gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0)

  var elementsBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementsBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(flatten(bunny.cells)), gl.STATIC_DRAW)

	for (var i = 0; i < 100; ++i) {
		console.time('REND');
  gl.drawElements(gl.TRIANGLES, bunny.cells.length * 3, gl.UNSIGNED_SHORT, 0)
		console.timeEnd('REND');
	}

  var filename = __filename + '.ppm' // eslint-disable-line
  log.info(__line, 'rendering ' + filename)
  utils.bufferToFile(gl, width, height, filename)
  log.info(__line, 'finished rendering ' + filename)

  gl.destroy()
}

// Taken from gl-mat4
// https://github.com/stackgl/gl-mat4/blob/master/lookAt.js
function lookAt (eye, center, up) {
  var x0, x1, x2, y0, y1, y2, z0, z1, z2, len
  var eyex = eye[0]
  var eyey = eye[1]
  var eyez = eye[2]
  var upx = up[0]
  var upy = up[1]
  var upz = up[2]
  var centerx = center[0]
  var centery = center[1]
  var centerz = center[2]

  z0 = eyex - centerx
  z1 = eyey - centery
  z2 = eyez - centerz

  len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2)
  z0 *= len
  z1 *= len
  z2 *= len

  x0 = upy * z2 - upz * z1
  x1 = upz * z0 - upx * z2
  x2 = upx * z1 - upy * z0
  len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2)
  if (!len) {
    x0 = 0
    x1 = 0
    x2 = 0
  } else {
    len = 1 / len
    x0 *= len
    x1 *= len
    x2 *= len
  }

  y0 = z1 * x2 - z2 * x1
  y1 = z2 * x0 - z0 * x2
  y2 = z0 * x1 - z1 * x0

  len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2)
  if (!len) {
    y0 = 0
    y1 = 0
    y2 = 0
  } else {
    len = 1 / len
    y0 *= len
    y1 *= len
    y2 *= len
  }

  return [
    x0, y0, z0, 0,
    x1, y1, z1, 0,
    x2, y2, z2, 0, -(x0 * eyex + x1 * eyey + x2 * eyez), -(y0 * eyex + y1 * eyey + y2 * eyez), -(z0 * eyex + z1 * eyey + z2 * eyez),
    1
  ]
}

// Taken from gl-mat4
// https://github.com/stackgl/gl-mat4/blob/master/perspective.js
function perspective (fovy, aspect, near, far) {
  var f = 1.0 / Math.tan(fovy / 2)
  var nf = 1 / (near - far)

  return [
    f / aspect, 0.0, 0.0, 0.0,
    0.0, f, 0.0, 0.0,
    0.0, 0.0, (far + near) * nf, -1.0,
    0.0, 0.0, (2 * far * near) * nf, 0.0
  ]
}

main()
