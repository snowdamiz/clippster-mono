#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// Audio effect settings for FFmpeg filter generation
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
pub fn build_audio_effect_filter(
    effect: &AudioEffectSettings,
) -> Result<String, String> {
    let intensity = effect.intensity.clamp(0.0, 1.0);
    let enable_expr = format!("enable='between(t,{},{})'", effect.start_time, effect.end_time);
    
    let filter = match effect.effect_type.as_str() {
        // Volume & Dynamics
        "gain" => {
            let gain = get_param_f64(&effect.parameters, "gain", 0.0);
            format!("volume={}dB:{}", gain, enable_expr)
        }
        "normalize" => {
            let target = get_param_f64(&effect.parameters, "target", -16.0);
            format!("loudnorm=I={}:TP=-1.5:LRA=11", target)
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
        "noise-gate" => {
            let threshold = get_param_f64(&effect.parameters, "threshold", -40.0);
            let attack = get_param_f64(&effect.parameters, "attack", 5.0) / 1000.0;
            let release = get_param_f64(&effect.parameters, "release", 50.0) / 1000.0;
            format!("agate=threshold={}dB:attack={}:release={}:{}", 
                threshold, attack, release, enable_expr)
        }
        "expander" => {
            let threshold = get_param_f64(&effect.parameters, "threshold", -40.0);
            let ratio = get_param_f64(&effect.parameters, "ratio", 2.0);
            let attack = get_param_f64(&effect.parameters, "attack", 10.0) / 1000.0;
            let release = get_param_f64(&effect.parameters, "release", 100.0) / 1000.0;
            format!("acompressor=threshold={}dB:ratio={}:attack={}:release={}:mode=downward:{}", 
                threshold, ratio, attack, release, enable_expr)
        }
        
        // EQ & Tone
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
        "de-esser" => {
            let threshold = get_param_f64(&effect.parameters, "threshold", -20.0);
            format!("highpass=f=4000,acompressor=threshold={}dB:ratio=10:attack=0.003:release=0.05,lowpass=f=10000:{}", 
                threshold, enable_expr)
        }
        
        // Spatial & Stereo
        "pan" => {
            let pan = get_param_f64(&effect.parameters, "pan", 0.0);
            format!("stereotools=balance_out={}:{}", pan, enable_expr)
        }
        "stereo-width" => {
            let width = get_param_f64(&effect.parameters, "width", 1.0);
            format!("stereotools=sbal={}:{}", width, enable_expr)
        }
        "mono" => {
            format!("pan=mono|c0=0.5*c0+0.5*c1:{}", enable_expr)
        }
        "channel-swap" => {
            format!("pan=stereo|c0=c1|c1=c0:{}", enable_expr)
        }
        "surround" => {
            let depth = get_param_f64(&effect.parameters, "depth", 0.5) * intensity;
            format!("aecho=0.8:0.88:{}:{}:{}", 60.0 * depth, 0.4 * depth, enable_expr)
        }
        
        // Time-Based Effects
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
        "chorus" => {
            format!("chorus=0.5:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3:{}", enable_expr)
        }
        "flanger" => {
            let delay = get_param_f64(&effect.parameters, "delay", 5.0);
            let depth = get_param_f64(&effect.parameters, "depth", 2.0);
            let feedback = get_param_f64(&effect.parameters, "feedback", 0.5);
            let rate = get_param_f64(&effect.parameters, "rate", 0.5);
            format!("flanger=delay={}:depth={}:regen={}:speed={}:{}", 
                delay, depth, feedback, rate, enable_expr)
        }
        "phaser" => {
            let delay = get_param_f64(&effect.parameters, "delay", 3.0);
            let decay = get_param_f64(&effect.parameters, "decay", 0.4);
            let rate = get_param_f64(&effect.parameters, "rate", 0.5);
            format!("aphaser=in_gain=0.9:out_gain=0.9:delay={}:decay={}:speed={}:{}", 
                delay, decay, rate, enable_expr)
        }
        
        // Pitch & Speed
        "pitch-shift" => {
            let semitones = get_param_f64(&effect.parameters, "semitones", 0.0);
            let pitch_factor = 2.0_f64.powf(semitones / 12.0);
            format!("rubberband=pitch={}:{}", pitch_factor, enable_expr)
        }
        "speed" => {
            let speed = get_param_f64(&effect.parameters, "speed", 1.0);
            format!("atempo={}:{}", speed.clamp(0.5, 2.0), enable_expr)
        }
        "time-stretch" => {
            let tempo = get_param_f64(&effect.parameters, "tempo", 1.0);
            format!("rubberband=tempo={}:{}", tempo, enable_expr)
        }
        "vibrato" => {
            let rate = get_param_f64(&effect.parameters, "rate", 5.0);
            let depth = get_param_f64(&effect.parameters, "depth", 0.5) * intensity;
            format!("vibrato=f={}:d={}:{}", rate, depth, enable_expr)
        }
        
        // Voice Effects
        "voice-chipmunk" => {
            format!("asetrate=44100*1.5,aresample=44100,atempo=0.67:{}", enable_expr)
        }
        "voice-deep" => {
            format!("asetrate=44100*0.7,aresample=44100,atempo=1.43:{}", enable_expr)
        }
        "voice-echo" => {
            format!("aecho=0.8:0.9:500|1000:0.5|0.3:{}", enable_expr)
        }
        "voice-electronic" => {
            format!("afftfilt=real='hypot(re,im)*cos(random(0)*2*PI)':imag='hypot(re,im)*sin(random(0)*2*PI)':win_size=512:overlap=0.75:{}", enable_expr)
        }
        "voice-ethereal" => {
            format!("aecho=0.8:0.9:100|200|300:0.4|0.3|0.2,highpass=f=200,treble=g=3:{}", enable_expr)
        }
        "voice-giant" => {
            format!("asetrate=44100*0.6,aresample=44100,atempo=1.67,bass=g=10:{}", enable_expr)
        }
        "voice-helium" => {
            format!("asetrate=44100*2,aresample=44100,atempo=0.5:{}", enable_expr)
        }
        "voice-megaphone" => {
            format!("highpass=f=300,lowpass=f=3000,acrusher=bits=8:mode=log:aa=1:{}", enable_expr)
        }
        "voice-mic" => {
            format!("highpass=f=80,equalizer=f=200:g=2,equalizer=f=3000:g=3,acompressor=threshold=-20dB:ratio=3:{}", enable_expr)
        }
        "voice-monster" => {
            format!("asetrate=44100*0.5,aresample=44100,atempo=2,acrusher=bits=4:mode=log,bass=g=15:{}", enable_expr)
        }
        "voice-radio" => {
            format!("highpass=f=300,lowpass=f=3400,acrusher=bits=6:mode=log:aa=1:{}", enable_expr)
        }
        "voice-synth" => {
            format!("aphaser=in_gain=0.9:out_gain=0.9:delay=3:decay=0.6:speed=2,chorus=0.5:0.9:50:0.4:0.25:2:{}", enable_expr)
        }
        "voice-vibrato" => {
            let rate = get_param_f64(&effect.parameters, "rate", 6.0);
            let depth = get_param_f64(&effect.parameters, "depth", 0.5);
            format!("vibrato=f={}:d={}:{}", rate, depth, enable_expr)
        }
        
        // Voice Enhancement
        "noise-reduction" => {
            let amount = get_param_f64(&effect.parameters, "amount", -25.0);
            format!("afftdn=nf={}:tn=1:{}", amount, enable_expr)
        }
        "wind-reduction" => {
            format!("highpass=f=100,afftdn=nf=-20:tn=1:{}", enable_expr)
        }
        "de-reverb" => {
            format!("agate=threshold=0.02:attack=0.005:release=0.05,highpass=f=120:{}", enable_expr)
        }
        "speech-enhance" => {
            format!("highpass=f=80,equalizer=f=3000:width_type=o:width=2:g=4,acompressor=threshold=-20dB:ratio=4:attack=0.005:release=0.05:{}", enable_expr)
        }
        "de-hum" => {
            let frequency = get_param_f64(&effect.parameters, "frequency", 60.0);
            let frequency2 = frequency * 2.0;
            format!("bandreject=f={}:width_type=q:w=5,bandreject=f={}:width_type=q:w=5:{}", 
                frequency, frequency2, enable_expr)
        }
        
        // Creative & Stylized
        "distortion" => {
            let bits = get_param_i32(&effect.parameters, "bits", 8);
            let samples = get_param_i32(&effect.parameters, "samples", 1);
            format!("acrusher=bits={}:mode=log:aa=1:samples={}:{}", bits, samples, enable_expr)
        }
        "bitcrusher" => {
            let bits = get_param_i32(&effect.parameters, "bits", 8);
            let samples = get_param_i32(&effect.parameters, "samples", 4);
            format!("acrusher=bits={}:mode=log:aa=0:samples={}:{}", bits, samples, enable_expr)
        }
        "telephone" => {
            format!("highpass=f=300,lowpass=f=3400:{}", enable_expr)
        }
        "radio-effect" => {
            format!("highpass=f=300,lowpass=f=3400,acrusher=bits=6:mode=log:aa=1:{}", enable_expr)
        }
        "underwater" => {
            let depth = get_param_f64(&effect.parameters, "depth", 500.0);
            format!("lowpass=f={},aecho=0.8:0.88:60:0.4:{}", depth, enable_expr)
        }
        "robot" => {
            let frequency = get_param_f64(&effect.parameters, "frequency", 30.0);
            format!("afftfilt=real='re*cos(2*PI*t*{})':imag='im*sin(2*PI*t*{})':{}", 
                frequency, frequency, enable_expr)
        }
        "lofi" => {
            format!("lowpass=f=4000,acrusher=bits=12:mode=log:aa=1,aecho=0.8:0.88:6:0.4:{}", enable_expr)
        }
        "vinyl" => {
            format!("lowpass=f=8000,highpass=f=30,aecho=0.8:0.88:6:0.1:{}", enable_expr)
        }
        
        // Fades & Automation
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
        "crossfade" => {
            // Crossfade typically requires 2 streams. For a single track effect, 
            // we'll pass through as this is likely handled by timeline composition.
            "anull".to_string()
        }
        "ducking" | "sidechain" => {
            // Fallback to standard compressor if sidechain input isn't available
            let threshold = get_param_f64(&effect.parameters, "threshold", -30.0);
            let ratio = get_param_f64(&effect.parameters, "ratio", 4.0);
            let attack = get_param_f64(&effect.parameters, "attack", 10.0) / 1000.0;
            let release = get_param_f64(&effect.parameters, "release", 200.0) / 1000.0;
            format!("acompressor=threshold={}dB:ratio={}:attack={}:release={}:{}", 
                threshold, ratio, attack, release, enable_expr)
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
