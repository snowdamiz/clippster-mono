/**
 * GPU-accelerated chromakey (green/blue/custom screen removal) via WebGL2.
 *
 * Implements the classic YCbCr chroma-key algorithm on the GPU:
 * 1. Convert RGB → YCbCr
 * 2. Compute chroma distance from key colour
 * 3. Build alpha mask with smooth threshold falloff
 * 4. Optionally spill-suppress (reduce residual green/blue fringe)
 *
 * Performance vs CPU path:
 *   CPU: O(width × height) per frame on the main thread (blocks RAF)
 *   GPU: parallel per-pixel in vertex shader, off main thread via WebGL
 *
 * Usage:
 *   const result = applyChromakeyGPU(ctx, w, h, settings);
 *   if (!result) fallback to CPU path;
 */

import type { ChromakeySettings } from "../../types/chromakey";
import {
	webglContextManager,
	QUAD_VERTEX_SHADER,
	drawFullscreenQuad,
} from "./webgl-context";

const FRAGMENT_SHADER = /* glsl */`#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform vec3 u_keyColor;      // RGB 0-1
uniform float u_threshold;    // similarity threshold 0-1
uniform float u_smoothness;   // edge softness 0-1
uniform float u_spillAmount;  // spill suppression strength 0-1

in vec2 v_uv;
out vec4 fragColor;

// Encode RGB to YCbCr (BT.601, full range)
vec3 rgbToYCbCr(vec3 rgb) {
	float y  =  0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
	float cb = -0.169 * rgb.r - 0.331 * rgb.g + 0.500 * rgb.b + 0.5;
	float cr =  0.500 * rgb.r - 0.419 * rgb.g - 0.081 * rgb.b + 0.5;
	return vec3(y, cb, cr);
}

void main() {
	vec4 src = texture(u_texture, v_uv);
	vec3 rgb = src.rgb;

	// Compute chroma-distance in YCbCr space (ignores luma differences)
	vec3 srcYCbCr = rgbToYCbCr(rgb);
	vec3 keyYCbCr = rgbToYCbCr(u_keyColor);
	float dist = distance(srcYCbCr.yz, keyYCbCr.yz);

	// Map distance to alpha:
	//  dist < threshold           → fully transparent (remove)
	//  threshold..threshold+soft  → partial alpha (smooth edge)
	//  dist > threshold+soft      → fully opaque
	float hard = u_threshold;
	float soft = u_smoothness * 0.3;
	float alpha = smoothstep(hard, hard + soft + 0.001, dist);

	// Spill suppression: desaturate chroma near key colour
	if (u_spillAmount > 0.0 && alpha < 1.0) {
		float spillMask = (1.0 - alpha) * u_spillAmount;
		// Reduce the dominant key channel toward neutral grey
		float keyR = u_keyColor.r;
		float keyG = u_keyColor.g;
		float keyB = u_keyColor.b;
		// Which channel dominates?
		float maxKey = max(keyR, max(keyG, keyB));
		if (maxKey > 0.5) {
			if (keyG >= keyR && keyG >= keyB) {
				// Green screen: reduce green, boost toward average of R/B
				float avg = (rgb.r + rgb.b) / 2.0;
				rgb.g = mix(rgb.g, avg, spillMask);
			} else if (keyB >= keyR && keyB >= keyG) {
				// Blue screen: reduce blue
				float avg = (rgb.r + rgb.g) / 2.0;
				rgb.b = mix(rgb.b, avg, spillMask);
			}
		}
	}

	fragColor = vec4(rgb * alpha, alpha);
}`;

let texture: WebGLTexture | null = null;
let vao: WebGLVertexArrayObject | null = null;
let lastGl: WebGL2RenderingContext | null = null;

/**
 * Apply chromakey using WebGL2 GPU shader.
 * Renders directly onto the 2D canvas context.
 *
 * Returns true on success; false on failure (caller should use CPU fallback).
 */
export function applyChromakeyGPU(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	settings: ChromakeySettings,
): boolean {
	const gl = webglContextManager.getContext();
	if (!gl) return false;

	try {
		// Get (cached) compiled program
		const prog = webglContextManager.getProgram(QUAD_VERTEX_SHADER, FRAGMENT_SHADER);
		if (!prog) return false;

		webglContextManager.resize(width, height);

		// Ensure VAO is created for this context
		if (lastGl !== gl) {
			vao = gl.createVertexArray();
			texture = gl.createTexture();
			lastGl = gl;
		}

		// Upload 2D canvas pixels → WebGL texture
		const imageData = ctx.getImageData(0, 0, width, height);

		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(
			gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
			gl.RGBA, gl.UNSIGNED_BYTE, imageData.data,
		);

		// Parse key colour
		const { r, g, b } = parseHexColor(settings.color ?? "#00ff00");

		// Set up shader
		gl.useProgram(prog.program);

		const texLoc = gl.getUniformLocation(prog.program, "u_texture");
		const keyLoc = gl.getUniformLocation(prog.program, "u_keyColor");
		const threshLoc = gl.getUniformLocation(prog.program, "u_threshold");
		const smoothLoc = gl.getUniformLocation(prog.program, "u_smoothness");
		const spillLoc = gl.getUniformLocation(prog.program, "u_spillAmount");

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(texLoc, 0);
		gl.uniform3f(keyLoc, r, g, b);
		gl.uniform1f(threshLoc, (settings.similarity ?? 0.3));
		gl.uniform1f(smoothLoc, (settings.smoothness ?? 0.1));
		gl.uniform1f(spillLoc, (settings.spillReduction ?? 0.1));

		// Draw
		gl.bindVertexArray(vao);
		const aPosLoc = gl.getAttribLocation(prog.program, "a_position");
		drawFullscreenQuad(gl, aPosLoc);

		// Read back pixels and write to 2D canvas
		// WebGL Y-axis is flipped vs Canvas 2D — we need to flip vertically
		const raw = webglContextManager.readPixels(width, height);
		if (!raw) return false;

		// Flip rows vertically (WebGL origin is bottom-left, Canvas is top-left)
		const flipped = new Uint8ClampedArray(width * height * 4);
		const rowBytes = width * 4;
		for (let row = 0; row < height; row++) {
			const srcRow = (height - 1 - row) * rowBytes;
			const dstRow = row * rowBytes;
			flipped.set(raw.subarray(srcRow, srcRow + rowBytes), dstRow);
		}

		const result = new ImageData(flipped, width, height);
		ctx.putImageData(result, 0, 0);

		return true;
	} catch (e) {
		console.warn("[WebGL] Chromakey GPU pass failed:", e);
		return false;
	}
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace("#", "");
	const bigint = parseInt(clean.length === 3
		? clean.split("").map((c) => c + c).join("")
		: clean, 16);
	return {
		r: ((bigint >> 16) & 255) / 255,
		g: ((bigint >> 8) & 255) / 255,
		b: (bigint & 255) / 255,
	};
}
