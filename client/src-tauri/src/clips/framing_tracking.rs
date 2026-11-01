use super::types::FramingKeyframe;

pub fn rebase_config(config: &mut super::types::ManualFramingConfig, offset: f64) {
    fn shift(regions: &mut [super::types::ManualRegion], offset: f64) {
        for region in regions {
            if let Some(points) = &mut region.source_keyframes {
                for p in points { p.time -= offset; }
            }
        }
    }
    shift(&mut config.regions, offset);
    if let Some(segments) = &mut config.segment_configs {
        for s in segments { s.start_time -= offset; s.end_time -= offset; shift(&mut s.regions, offset); }
    }
    if let Some(brolls) = &mut config.broll_configs {
        for b in brolls { b.start_time -= offset; b.end_time -= offset; }
    }
}

fn sum(terms: &[String]) -> String {
    if terms.len() == 1 { return terms[0].clone(); }
    let mid = terms.len() / 2;
    format!("({}+{})", sum(&terms[..mid]), sum(&terms[mid..]))
}

/// Match framingTracking.ts: hold through a cut, otherwise interpolate with smoothstep.
/// Balanced addition keeps FFmpeg's expression parser stack bounded for long paths.
pub fn crop_expression(points: &[FramingKeyframe], axis: char, scale: f64, max: f64) -> Result<String, String> {
    if points.is_empty() || points.len() > 5000 { return Err("Invalid Auto framing path length".into()); }
    for (i, p) in points.iter().enumerate() {
        if !p.time.is_finite() || !p.x.is_finite() || !p.y.is_finite()
            || !(0.0..=1.0).contains(&p.x) || !(0.0..=1.0).contains(&p.y)
            || (i > 0 && p.time <= points[i - 1].time) {
            return Err("Invalid Auto framing tracking point".into());
        }
    }
    let value = |p: &FramingKeyframe| if axis == 'x' { p.x } else { p.y };
    let mut terms = vec![format!("{:.6}", value(&points[0]))];
    for pair in points.windows(2) {
        let a = &pair[0]; let b = &pair[1];
        let delta = value(b) - value(a);
        if delta.abs() < 0.000001 { continue; }
        let ramp = if b.cut {
            format!("gte(t,{:.6})", b.time)
        } else {
            let u = format!("clip((t-({:.6}))/{:.6},0,1)", a.time, b.time - a.time);
            format!("({0}*{0}*(3-2*{0}))", u)
        };
        terms.push(format!("({:.6})*{}", delta, ramp));
    }
    Ok(format!("clip(({})*{:.6},0,{:.6})", sum(&terms), scale, max))
}

/// Filter graphs can exceed Windows' command-line limit. Clean up on every exit path.
pub struct FilterScript(pub std::path::PathBuf);
impl FilterScript {
    pub fn write(directory: &std::path::Path, graph: &str) -> Result<Self, String> {
        let file = Self(directory.join(format!("framing_{}.ffscript", uuid::Uuid::new_v4())));
        std::fs::write(&file.0, graph).map_err(|e| format!("Could not write framing filter: {}", e))?;
        Ok(file)
    }
}
impl Drop for FilterScript {
    fn drop(&mut self) { let _ = std::fs::remove_file(&self.0); }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn point(time: f64, x: f64, cut: bool) -> FramingKeyframe { FramingKeyframe { time, x, y: 0.0, cut } }
    #[test]
    fn smooth_pan_and_hard_cut() {
        let s = crop_expression(&[point(0.0, 0.1, false), point(1.0, 0.4, false), point(2.0, 0.2, true)], 'x', 1920.0, 1312.0).unwrap();
        assert!(s.contains("3-2*")); assert!(s.contains("gte(t,2.000000)"));
        assert!(s.contains("1312.000000"));
    }
    #[test]
    fn rejects_invalid_paths() {
        assert!(crop_expression(&[], 'x', 1.0, 1.0).is_err());
        assert!(crop_expression(&[point(0.0, 0.1, false), point(0.0, 0.2, false)], 'x', 1.0, 1.0).is_err());
        assert!(crop_expression(&[point(0.0, f64::NAN, false)], 'x', 1.0, 1.0).is_err());
    }
    #[test]
    fn later_segments_continue_the_reviewed_path() {
        let mut config: super::super::types::ManualFramingConfig = serde_json::from_value(serde_json::json!({
            "mode": "manual", "targetAspectRatio": "9:16",
            "regions": [{ "id": "tracked", "color": "#fff", "source": { "x": 0.1, "y": 0.0, "width": 0.3, "height": 1.0 },
                "output": { "x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0 },
                "sourceKeyframes": [{ "time": 0.0, "x": 0.1, "y": 0.0 }, { "time": 2.0, "x": 0.4, "y": 0.0 }, { "time": 5.0, "x": 0.5, "y": 0.0 }] }],
            "segmentConfigs": [{ "segmentId": "s", "startTime": 4.0, "endTime": 5.0, "regions": [] }]
        })).unwrap();
        rebase_config(&mut config, 2.0);
        let points = config.regions[0].source_keyframes.as_ref().unwrap();
        assert_eq!(points.iter().map(|p| p.time).collect::<Vec<_>>(), vec![-2.0, 0.0, 3.0]);
        assert_eq!(config.segment_configs.unwrap()[0].start_time, 2.0);
        assert!(crop_expression(points, 'x', 1920.0, 1300.0).unwrap().contains("t-(-2.000000)"));
    }
}
