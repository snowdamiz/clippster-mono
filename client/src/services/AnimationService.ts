import { TimelineItem, Keyframe, AnimationProperty } from '@/types/timeline-model';

/**
 * Service to handle keyframe animation interpolation
 */
export class AnimationService {
  
  /**
   * Calculate the interpolated value for a specific property at a given time
   * @param item The timeline item containing keyframes
   * @param property The property name to animate
   * @param time The relative time in seconds from the start of the item
   * @param defaultValue The default value if no keyframes exist
   * @returns The calculated value
   */
  static getValueAtTime(
    item: TimelineItem, 
    property: AnimationProperty, 
    time: number, 
    defaultValue: number
  ): number {
    if (!item.keyframes || item.keyframes.length === 0) {
      return defaultValue;
    }

    // Filter keyframes for this property and sort by time
    const propertyKeyframes = item.keyframes
      .filter(kf => kf.property === property)
      .sort((a, b) => a.time - b.time);

    if (propertyKeyframes.length === 0) {
      return defaultValue;
    }

    // If time is before first keyframe, return first keyframe value
    if (time <= propertyKeyframes[0].time) {
      return propertyKeyframes[0].value;
    }

    // If time is after last keyframe, return last keyframe value
    if (time >= propertyKeyframes[propertyKeyframes.length - 1].time) {
      return propertyKeyframes[propertyKeyframes.length - 1].value;
    }

    // Find the two keyframes surrounding the current time
    let prevKeyframe = propertyKeyframes[0];
    let nextKeyframe = propertyKeyframes[propertyKeyframes.length - 1];

    for (let i = 0; i < propertyKeyframes.length - 1; i++) {
      if (time >= propertyKeyframes[i].time && time < propertyKeyframes[i + 1].time) {
        prevKeyframe = propertyKeyframes[i];
        nextKeyframe = propertyKeyframes[i + 1];
        break;
      }
    }

    // Calculate progress (0 to 1) between keyframes
    const duration = nextKeyframe.time - prevKeyframe.time;
    if (duration <= 0) return prevKeyframe.value;

    const t = (time - prevKeyframe.time) / duration;

    // Apply Easing
    const easing = prevKeyframe.easing || 'linear';
    let easedT = t;

    switch (easing) {
      case 'step':
        return prevKeyframe.value;
      case 'linear':
        easedT = t;
        break;
      case 'ease-in':
        easedT = this.easeInQuad(t);
        break;
      case 'ease-out':
        easedT = this.easeOutQuad(t);
        break;
      case 'ease-in-out':
        easedT = this.easeInOutQuad(t);
        break;
      case 'bezier':
        if (prevKeyframe.controlPoints) {
          easedT = this.cubicBezier(t, prevKeyframe.controlPoints.x1, prevKeyframe.controlPoints.y1, prevKeyframe.controlPoints.x2, prevKeyframe.controlPoints.y2);
        } else {
          // Fallback to ease-in-out if control points missing
          easedT = this.easeInOutQuad(t);
        }
        break;
    }
    
    // Linear interpolation with eased time
    return this.lerp(prevKeyframe.value, nextKeyframe.value, easedT);
  }

  /**
   * Linear interpolation
   */
  private static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  // Standard Easing Functions (Quad)
  private static easeInQuad(t: number): number {
    return t * t;
  }

  private static easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  private static easeInOutQuad(t: number): number {
    return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // Cubic Bezier Solver
  // Based on http://www.gizma.com/easing/
  // Using a simplified version for common CSS-like transitions
  private static cubicBezier(t: number, x1: number, y1: number, x2: number, y2: number): number {
    // Basic approximation or use a library like bezier-easing if precision is critical
    // For now, implementing a simple polynomial evaluation
    // B(t) = (1-t)^3*P0 + 3*(1-t)^2*t*P1 + 3*(1-t)*t^2*P2 + t^3*P3
    // P0 is (0,0), P3 is (1,1)
    
    // We need to find 'x' such that Bx(x) = t (time), then return By(x) (value)
    // However, for animation 't' passed here IS the progress along X axis (time)
    // But bezier curves define x(T) and y(T) based on a parameter T (0->1)
    // We need to solve for T where x(T) == t, then evaluate y(T)
    
    // This requires Newton-Raphson iteration
    // For simplicity in this iteration, let's assume a simpler curve or linear if complexity is too high
    // Or we can implement a proper solver.
    
    return this.solveCubicBezier(t, x1, y1, x2, y2);
  }

  private static solveCubicBezier(x: number, x1: number, y1: number, x2: number, y2: number): number {
    // Solve for T given x
    let t = x;
    // Newton's method
    for (let i = 0; i < 5; i++) {
        const currentX = this.sampleCurveX(t, x1, x2) - x;
        if (Math.abs(currentX) < 1e-6) break;
        const currentDerivative = this.sampleCurveDerivativeX(t, x1, x2);
        if (Math.abs(currentDerivative) < 1e-6) break;
        t -= currentX / currentDerivative;
    }
    return this.sampleCurveY(t, y1, y2);
  }

  private static sampleCurveX(t: number, x1: number, x2: number): number {
    // (1-t)^3 * 0 + 3*(1-t)^2*t*x1 + 3*(1-t)*t^2*x2 + t^3 * 1
    return 3 * Math.pow(1 - t, 2) * t * x1 + 3 * (1 - t) * Math.pow(t, 2) * x2 + Math.pow(t, 3);
  }

  private static sampleCurveY(t: number, y1: number, y2: number): number {
    // (1-t)^3 * 0 + 3*(1-t)^2*t*y1 + 3*(1-t)*t^2*y2 + t^3 * 1
    return 3 * Math.pow(1 - t, 2) * t * y1 + 3 * (1 - t) * Math.pow(t, 2) * y2 + Math.pow(t, 3);
  }

  private static sampleCurveDerivativeX(t: number, x1: number, x2: number): number {
    // Derivative of sampleCurveX
    return 3 * Math.pow(1 - t, 2) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * Math.pow(t, 2) * (1 - x2);
  }
}
