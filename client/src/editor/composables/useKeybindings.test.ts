import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeAction } = vi.hoisted(() => ({
	invokeAction: vi.fn(),
}));

vi.mock("../lib/actions", () => ({
	bindAction: vi.fn(),
	invokeAction,
	unbindAction: vi.fn(),
}));

vi.mock("../core", () => ({
	EditorCore: {
		getInstance: () => ({ imageMode: false }),
	},
}));

vi.mock("./useImageEditorTools", () => ({
	IMAGE_TOOL_RAIL: [],
	useImageEditorTools: () => ({
		activateTool: vi.fn(),
		swapFillStroke: vi.fn(),
	}),
}));

import { handleEditorKeyDown } from "./useKeybindings";

function press(key: string, modifiers: Partial<KeyboardEvent> = {}) {
	const preventDefault = vi.fn();
	handleEditorKeyDown({
		key,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		altKey: false,
		target: null,
		preventDefault,
		...modifiers,
	} as unknown as KeyboardEvent);
	return preventDefault;
}

describe("editor keyboard shortcuts", () => {
	beforeEach(() => {
		invokeAction.mockClear();
	});

	it.each([
		["j", "seek-backward", { seconds: 1 }],
		["k", "toggle-play", undefined],
		["l", "seek-forward", { seconds: 1 }],
		["q", "split-left", undefined],
		["w", "split-right", undefined],
		["n", "toggle-snapping", undefined],
	] as const)("maps %s to %s", (key, action, args) => {
		const preventDefault = press(key);

		expect(invokeAction).toHaveBeenCalledWith(action, args, "keypress");
		expect(preventDefault).toHaveBeenCalledOnce();
	});

	it("maps Ctrl+X to cut", () => {
		press("x", { ctrlKey: true });
		expect(invokeAction).toHaveBeenCalledWith("cut-selected", undefined, "keypress");
	});

	it("maps Shift+F to freeze frame", () => {
		press("F", { shiftKey: true });
		expect(invokeAction).toHaveBeenCalledWith("freeze-frame", undefined, "keypress");
	});

	it("preserves B as bookmark and does not claim plain C", () => {
		press("b");
		expect(invokeAction).toHaveBeenCalledWith("toggle-bookmark", undefined, "keypress");

		invokeAction.mockClear();
		const preventDefault = press("c");
		expect(invokeAction).not.toHaveBeenCalled();
		expect(preventDefault).not.toHaveBeenCalled();
	});
});
