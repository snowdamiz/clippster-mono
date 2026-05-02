/**
 * GPU path for invert / negative post-draw when WebGL2 is available.
 * Uploads the current 2D canvas, inverts RGB in a fragment shader, blits back.
 */
import { webglContextManager, QUAD_VERTEX_SHADER, drawFullscreenQuad } from "./webgl-context";
import { isGpuPreviewEffectsEnabled } from "./preview-gpu-config";

const FRAG_INVERT = /* glsl */`#version 300 es
precision highp float;
uniform sampler2D u_texture;
in vec2 v_uv;
out vec4 fragColor;

void main() {
	vec4 c = texture(u_texture, vec2(v_uv.x, 1.0 - v_uv.y));
	fragColor = vec4(1.0 - c.rgb, c.a);
}
`;

let invertProgramKey: { program: WebGLProgram; aPos: number; uTex: WebGLUniformLocation | null } | null = null;

function getInvertProgram(gl: WebGL2RenderingContext) {
	if (invertProgramKey) return invertProgramKey;
	const cached = webglContextManager.getProgram(QUAD_VERTEX_SHADER, FRAG_INVERT);
	if (!cached) return null;
	const glP = cached.program;
	const aPos = gl.getAttribLocation(glP, "a_position");
	const uTex = gl.getUniformLocation(glP, "u_texture");
	invertProgramKey = { program: glP, aPos, uTex };
	return invertProgramKey;
}

export function tryGpuInvertCanvas2D(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	intensity: number,
): boolean {
	// Full GPU invert only at high intensity; partial mix uses CPU path.
	if (intensity < 99) return false;
	if (!isGpuPreviewEffectsEnabled() || width <= 0 || height <= 0) return false;

	const gl = webglContextManager.getContext();
	if (!gl) return false;

	const surf = webglContextManager.getDrawingSurface();
	if (!surf) return false;

	webglContextManager.resize(width, height);

	const prog = getInvertProgram(gl);
	if (!prog) return false;

	// Snapshot — cannot sample the same canvas WebGL is drawing to as texture.
	const snap = document.createElement("canvas");
	snap.width = width;
	snap.height = height;
	const sctx = snap.getContext("2d");
	if (!sctx) return false;
	sctx.drawImage(ctx.canvas, 0, 0, width, height);

	const tex = gl.createTexture();
	if (!tex) return false;

	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snap);

	gl.viewport(0, 0, width, height);
	gl.useProgram(prog.program);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, tex);
	if (prog.uTex) gl.uniform1i(prog.uTex, 0);

	drawFullscreenQuad(gl, prog.aPos);
	gl.deleteTexture(tex);

	ctx.clearRect(0, 0, width, height);
	ctx.drawImage(surf, 0, 0, width, height);
	return true;
}
