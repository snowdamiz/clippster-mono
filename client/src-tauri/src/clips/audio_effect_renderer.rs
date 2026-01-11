#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// Audio effect settings for FFmpeg filter generation
/// Only includes effects that can be previewed with Web Audio API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioEffectSettings {
    pub id: String,
    pub effect_type: String,
    pub start_time: f64,
    pub end_time: f64,
    pub intensity: f64,
    #[serde(default)]
    pub parameters: Option<serde_json::Value>,
}

/// Build FFmpeg audio filter string for a single effect
/// Only supports effects that have Web Audio API preview equivalents
pub fn build_audio_effect_filter(
    effect: &AudioEffectSettings,
) -> Result<String, String> {
    let intensity = effect.intensity.clamp(0.0, 1.0);
    let enable_expr = format!("enable='between(t,{},{})'", effect.start_time, effect.end_time);
    
    let filter = match effect.effect_type.as_str() {
        // ============================================
        // Volume & Dynamics (Web Audio: GainNode, DynamicsCompressorNode)
        // ============================================
        "gain" => {
            let gain = get_param_f64(&effect.parameters, "gain", 0.0);
            format!("volume={}dB:{}", gain, enable_expr)
        }
        "compressor" => {
            let threshold = get_param_f64(&effect.parameters, "threshold", -24.0);
            let ratio = get_param_f64(&effect.parameters, "ratio", 4.0);
            let attack = get_param_f64(&effect.parameters, "attack", 5.0) / 1000.0;
            let release = get_param_f64(&effect.parameters, "release", 50.0) / 1000.0;
            format!("acompressor=threshold={}dB:ratio={}:attack={}:release={}:{}", 
                threshold, ratio, attack, release, enable_expr)
        }
        "limiter" => {
            let limit = get_param_f64(&effect.parameters, "limit", -1.0);
            let attack = get_param_f64(&effect.parameters, "attack", 5.0) / 1000.0;
            let release = get_param_f64(&effect.parameters, "release", 50.0) / 1000.0;
            format!("alimiter=limit={}dB:attack={}:release={}:{}", 
                limit, attack, release, enable_expr)
        }
        
        // ============================================
        // EQ & Tone (Web Audio: BiquadFilterNode)
        // ============================================
        "lowpass" => {
            let frequency = get_param_f64(&effect.parameters, "frequency", 2000.0);
            let poles = get_param_i32(&effect.parameters, "poles", 2);
            format!("lowpass=f={}:p={}:{}", frequency, poles, enable_expr)
        }
        "highpass" => {
            let frequency = get_param_f64(&effect.parameters, "frequency", 200.0);
            let poles = get_param_i32(&effect.parameters, "poles", 2);
            format!("highpass=f={}:p={}:{}", frequency, poles, enable_expr)
        }
        "bandpass" => {
            let frequency = get_param_f64(&effect.parameters, "frequency", 1000.0);
            let q = get_param_f64(&effect.parameters, "q", 2.0);
            format!("bandpass=f={}:width_type=q:w={}:{}", frequency, q, enable_expr)
        }
        "bass-boost" => {
            let gain = get_param_f64(&effect.parameters, "gain", 6.0) * intensity;
            let frequency = get_param_f64(&effect.parameters, "frequency", 100.0);
            format!("bass=g={}:f={}:{}", gain, frequency, enable_expr)
        }
        "treble-boost" => {
            let gain = get_param_f64(&effect.parameters, "gain", 6.0) * intensity;
            let frequency = get_param_f64(&effect.parameters, "frequency", 3000.0);
            format!("treble=g={}:f={}:{}", gain, frequency, enable_expr)
        }
        "parametric-eq" => {
            let frequency = get_param_f64(&effect.parameters, "frequency", 1000.0);
            let q = get_param_f64(&effect.parameters, "q", 1.0);
            let gain = get_param_f64(&effect.parameters, "gain", 0.0);
            format!("equalizer=f={}:width_type=q:width={}:g={}:{}", frequency, q, gain, enable_expr)
        }
        
        // ============================================
        // Spatial & Stereo (Web Audio: StereoPannerNode)
        // ============================================
        "pan" => {
            let pan = get_param_f64(&effect.parameters, "pan", 0.0);
            format!("stereotools=balance_out={}:{}", pan, enable_expr)
        }
        
        // ============================================
        // Time-Based Effects (Web Audio: ConvolverNode, DelayNode)
        // ============================================
        "reverb" => {
            let delay = get_param_f64(&effect.parameters, "delay", 100.0);
            let decay = get_param_f64(&effect.parameters, "decay", 0.5) * intensity;
            format!("aecho=0.8:0.9:{}:{}:{}", delay, decay, enable_expr)
        }
        "delay" => {
            let time = get_param_f64(&effect.parameters, "time", 300.0);
            let feedback = get_param_f64(&effect.parameters, "feedback", 0.5) * intensity;
            format!("aecho=0.8:0.88:{}:{}:{}", time, feedback, enable_expr)
        }
        
        // ============================================
        // Creative & Stylized (Web Audio: WaveShaperNode)
        // ============================================
        "distortion" => {
            let bits = get_param_i32(&effect.parameters, "bits", 8);
            let samples = get_param_i32(&effect.parameters, "samples", 1);
            format!("acrusher=bits={}:mode=log:aa=1:samples={}:{}", bits, samples, enable_expr)
        }
        
        // ============================================
        // Fades & Automation (Web Audio: GainNode with automation)
        // ============================================
        "fade-in" => {
            let duration = get_param_f64(&effect.parameters, "duration", 1.0);
            format!("afade=t=in:st={}:d={}", effect.start_time, duration)
        }
        "fade-out" => {
            let duration = get_param_f64(&effect.parameters, "duration", 1.0);
            format!("afade=t=out:st={}:d={}", effect.end_time - duration, duration)
        }
        "volume-automation" => {
            let gain = get_param_f64(&effect.parameters, "gain", 0.0);
            format!("volume={}dB:{}", gain, enable_expr)
        }
        
        // Default: pass-through
        _ => {
            log::warn!("Unknown audio effect type: {}, using anull filter", effect.effect_type);
            "anull".to_string()
        }
    };
    
    Ok(filter)
}

/// Build a complete audio filter chain for all effects applied to a track
pub fn build_audio_effects_filter_chain(
    effects: &[AudioEffectSettings],
) -> Result<Option<String>, String> {
    if effects.is_empty() {
        return Ok(None);
    }
    
    // Sort effects by start time
    let mut sorted_effects = effects.to_vec();
    sorted_effects.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
    
    let mut filters = Vec::new();
    
    for effect in &sorted_effects {
        match build_audio_effect_filter(effect) {
            Ok(filter) => {
                if filter != "anull" {
                    filters.push(filter);
                }
            }
            Err(e) => {
                log::warn!("Failed to build audio filter for effect {}: {}", effect.id, e);
            }
        }
    }
    
    if filters.is_empty() {
        return Ok(None);
    }
    
    Ok(Some(filters.join(",")))
}

// Helper functions
fn get_param_f64(params: &Option<serde_json::Value>, key: &str, default: f64) -> f64 {
    params
        .as_ref()
        .and_then(|p| p.get(key))
        .and_then(|v| v.as_f64())
        .unwrap_or(default)
}

fn get_param_i32(params: &Option<serde_json::Value>, key: &str, default: i32) -> i32 {
    params
        .as_ref()
        .and_then(|p| p.get(key))
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(default)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_gain_effect() {
        let effect = AudioEffectSettings {
            id: "test".to_string(),
            effect_type: "gain".to_string(),
            start_time: 0.0,
            end_time: 5.0,
            intensity: 1.0,
            parameters: Some(serde_json::json!({"gain": 6})),
        };
        
        let filter = build_audio_effect_filter(&effect).unwrap();
        assert!(filter.contains("volume=6dB"));
        assert!(filter.contains("enable='between(t,0,5)'"));
    }
    
    #[test]
    fn test_compressor_effect() {
        let effect = AudioEffectSettings {
            id: "test".to_string(),
            effect_type: "compressor".to_string(),
            start_time: 1.0,
            end_time: 10.0,
            intensity: 1.0,
            parameters: Some(serde_json::json!({"threshold": -20, "ratio": 4, "attack": 10, "release": 100})),
        };
        
        let filter = build_audio_effect_filter(&effect).unwrap();
        assert!(filter.contains("acompressor"));
        assert!(filter.contains("threshold=-20dB"));
        assert!(filter.contains("ratio=4"));
    }
    
    #[test]
    fn test_voice_chipmunk() {
        let effect = AudioEffectSettings {
            id: "test".to_string(),
            effect_type: "voice-chipmunk".to_string(),
            start_time: 0.0,
            end_time: 5.0,
            intensity: 1.0,
            parameters: None,
        };
        
        let filter = build_audio_effect_filter(&effect).unwrap();
        assert!(filter.contains("asetrate=44100*1.5"));
        assert!(filter.contains("atempo=0.67"));
    }
    
    #[test]
    fn test_filter_chain() {
        let effects = vec![
            AudioEffectSettings {
                id: "1".to_string(),
                effect_type: "highpass".to_string(),
                start_time: 0.0,
                end_time: 10.0,
                intensity: 1.0,
                parameters: Some(serde_json::json!({"frequency": 200})),
            },
            AudioEffectSettings {
                id: "2".to_string(),
                effect_type: "compressor".to_string(),
                start_time: 0.0,
                end_time: 10.0,
                intensity: 1.0,
                parameters: None,
            },
        ];
        
        let chain = build_audio_effects_filter_chain(&effects).unwrap();
        assert!(chain.is_some());
        let chain_str = chain.unwrap();
        assert!(chain_str.contains("highpass"));
        assert!(chain_str.contains("acompressor"));
        assert!(chain_str.contains(","));
    }
}
