/**
 * Singleton WebGL2 context manager.
 *
 * Maintains one hidden OffscreenCanvas + WebGL2RenderingContext shared across
 * all GPU effect passes. Shader programs are compiled once and cached by
 * (vertex source + fragment source) key to avoid redundant GPU compilation.
 *
 * Falls back gracefully: if WebGL2 is unavailable, `getContext()` returns null
 * and callers should fall back to the CPU path.
 */

interface CachedProgram {
	program: WebGLProgram;
	/** Cached attribute locations */
	attribs: Record<string, number>;
	/** Cached uniform locations */
	uniforms: Record<string, WebGLUniformLocation | null>;
}

class WebGLContextManager {
	private canvas: OffscreenCanvas | null = null;
	private gl: WebGL2RenderingContext | null = null;
	private programCache = new Map<string, CachedProgram>();
	private initAttempted = false;

	/** Returns the shared WebGL2 context, or null if unavailable. */
	getContext(): WebGL2RenderingContext | null {
		if (this.initAttempted) return this.gl;
		this.initAttempted = true;

		try {
			this.canvas = new OffscreenCanvas(1, 1);
			const gl = this.canvas.getContext("webgl2", {
				premultipliedAlpha: false,
				preserveDrawingBuffer: true,
				antialias: false,
				depth: false,
				stencil: false,
			}) as WebGL2RenderingContext | null;

			if (!gl) {
				console.warn("[WebGL] WebGL2 not available — GPU effects will use CPU fallback");
				return null;
			}

			this.gl = gl;
			return gl;
		} catch (e) {
			console.warn("[WebGL] Failed to create WebGL2 context:", e);
			return null;
		}
	}

	/**
	 * Returns a cached compiled program, compiling it on first use.
	 * Key is derived from the vertex + fragment source.
	 */
	getProgram(
		vertexSource: string,
		fragmentSource: string,
	): CachedProgram | null {
		const gl = this.getContext();
		if (!gl) return null;

		const key = `${vertexSource.length}:${fragmentSource.length}:${fragmentSource.slice(-32)}`;
		const cached = this.programCache.get(key);
		if (cached) return cached;

		const program = compileProgram(gl, vertexSource, fragmentSource);
		if (!program) return null;

		const entry: CachedProgram = { program, attribs: {}, uniforms: {} };
		this.programCache.set(key, entry);
		return entry;
	}

	/**
	 * Resize the shared canvas if needed.
	 * Must be called before rendering to a new canvas size.
	 */
	resize(width: number, height: number): void {
		if (!this.canvas) return;
		if (this.canvas.width !== width || this.canvas.height !== height) {
			this.canvas.width = width;
			this.canvas.height = height;
			this.gl?.viewport(0, 0, width, height);
		}
	}

	/** Read the current framebuffer as an ImageData (for copying to 2D canvas). */
	readPixels(width: number, height: number): Uint8ClampedArray<ArrayBuffer> | null {
		const gl = this.gl;
		if (!gl) return null;
		const pixels = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
		gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		return pixels;
	}
}

// ── Shader compilation helpers ────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error("[WebGL] Shader compile error:", gl.getShaderInfoLog(shader));
		console.error("[WebGL] Source:", source);
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}

function compileProgram(
	gl: WebGL2RenderingContext,
	vertexSource: string,
	fragmentSource: string,
): WebGLProgram | null {
	const vert = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
	const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	if (!vert || !frag) return null;

	const program = gl.createProgram();
	if (!program) return null;

	gl.attachShader(program, vert);
	gl.attachShader(program, frag);
	gl.linkProgram(program);

	gl.deleteShader(vert);
	gl.deleteShader(frag);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("[WebGL] Program link error:", gl.getProgramInfoLog(program));
		gl.deleteProgram(program);
		return null;
	}

	return program;
}

// ── Full-screen quad helpers ──────────────────────────────────────────────────

/** Standard passthrough vertex shader for fullscreen quad effects. */
export const QUAD_VERTEX_SHADER = /* glsl */`#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
	v_uv = a_position * 0.5 + 0.5;
	gl_Position = vec4(a_position, 0.0, 1.0);
}`;

let quadBuffer: WebGLBuffer | null = null;
let quadBufferGl: WebGL2RenderingContext | null = null;

/**
 * Binds a fullscreen quad VBO and draws two triangles.
 * Reuses the same buffer across calls for the same context.
 */
export function drawFullscreenQuad(gl: WebGL2RenderingContext, aPosLoc: number): void {
	if (quadBufferGl !== gl || !quadBuffer) {
		quadBuffer = gl.createBuffer();
		quadBufferGl = gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW,
		);
	} else {
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
	}

	gl.enableVertexAttribArray(aPosLoc);
	gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const webglContextManager = new WebGLContextManager();
