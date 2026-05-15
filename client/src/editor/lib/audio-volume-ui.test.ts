import { describe, it, expect } from "vitest";
import {
	linearGainToDb,
	dbToLinearGain,
	gainToSliderPosition,
	sliderPositionToGain,
	gainToSliderStep,
	sliderStepToGain,
	parseVolumeDbInput,
	CLIP_GAIN_MAX,
	CLIP_VOLUME_SLIDER_DB_MAX,
} from "./audio-volume-ui";

describe("audio-volume-ui", () => {
	it("unity gain is 0 dB", () => {
		expect(linearGainToDb(1)).toBeCloseTo(0, 5);
	});

	it("max linear gain is about +12 dB", () => {
		expect(linearGainToDb(CLIP_GAIN_MAX)).toBeCloseTo(CLIP_VOLUME_SLIDER_DB_MAX, 1);
	});

	it("dbToLinearGain round-trips near unity", () => {
		expect(dbToLinearGain(-6)).toBeCloseTo(0.5, 2);
		expect(dbToLinearGain(0)).toBeCloseTo(1, 5);
	});

	it("slider center is unity", () => {
		expect(sliderPositionToGain(0.5)).toBeCloseTo(1, 5);
		expect(gainToSliderPosition(1)).toBeCloseTo(0.5, 5);
	});

	it("slider ends map to min and max gain", () => {
		expect(sliderPositionToGain(1)).toBeCloseTo(CLIP_GAIN_MAX, 2);
		expect(sliderStepToGain(0)).toBe(0);
	});

	it("parseVolumeDbInput accepts common forms", () => {
		expect(parseVolumeDbInput("-6")).toBe(-6);
		expect(parseVolumeDbInput("+3 dB")).toBe(3);
		expect(parseVolumeDbInput("0")).toBe(0);
		expect(Number.isNaN(parseVolumeDbInput(""))).toBe(true);
	});
});
