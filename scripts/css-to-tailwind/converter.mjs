/**
 * CSS to Tailwind Converter
 * 
 * Converts CSS declarations to Tailwind utility classes.
 */

import { directMappings, propertyConverters } from './mappings.mjs';

/**
 * Convert a CSS declaration to Tailwind class(es)
 * @param {string} property - CSS property name
 * @param {string} value - CSS property value
 * @returns {Object} Conversion result
 */
export function convertDeclaration(property, value) {
  // Normalize property and value
  property = property.trim().toLowerCase();
  value = value.trim();
  
  // Remove !important for processing (we'll note it)
  const isImportant = value.includes('!important');
  if (isImportant) {
    value = value.replace(/\s*!important\s*$/, '').trim();
  }
  
  // Check direct mappings first
  const directKey = `${property}: ${value}`;
  if (directMappings[directKey]) {
    return {
      success: true,
      classes: [addImportant(directMappings[directKey], isImportant)],
      property,
      value,
    };
  }
  
  // Try property-specific converter
  if (propertyConverters[property]) {
    try {
      const result = propertyConverters[property](value);
      if (result) {
        // Use smart split that respects brackets
        const classes = smartSplitClasses(result).map(c => addImportant(c, isImportant));
        return {
          success: true,
          classes,
          property,
          value,
        };
      }
    } catch (error) {
      console.warn(`Converter error for ${property}: ${value}`, error.message);
    }
  }
  
  // Cannot convert - return failure
  return {
    success: false,
    classes: [],
    property,
    value,
    reason: 'No mapping found',
  };
}

/**
 * Add ! prefix for important declarations in Tailwind
 * @param {string} className - Tailwind class
 * @param {boolean} isImportant - Whether !important was used
 * @returns {string} Class with optional ! prefix
 */
function addImportant(className, isImportant) {
  if (!isImportant) return className;
  return `!${className}`;
}

/**
 * Smart split for Tailwind classes that respects brackets
 * Standard split(' ') would break values like border-[rgba(255, 255, 255, 0.15)]
 * @param {string} str - String of space-separated classes
 * @returns {Array} Array of class names
 */
function smartSplitClasses(str) {
  const classes = [];
  let current = '';
  let bracketDepth = 0;
  let parenDepth = 0;
  
  for (const char of str) {
    if (char === '[') {
      bracketDepth++;
      current += char;
    } else if (char === ']') {
      bracketDepth--;
      current += char;
    } else if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth--;
      current += char;
    } else if (char === ' ' && bracketDepth === 0 && parenDepth === 0) {
      if (current.trim()) {
        classes.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    classes.push(current.trim());
  }
  
  return classes;
}

/**
 * Convert a complete CSS rule to Tailwind classes
 * @param {Object} rule - Parsed CSS rule object
 * @returns {Object} Conversion result with classes and unconverted declarations
 */
export function convertRule(rule) {
  if (!rule.isConvertible) {
    return {
      success: false,
      classes: [],
      unconverted: rule.declarations || [],
      reason: 'Complex selector not supported',
      selector: rule.selector,
    };
  }
  
  const result = {
    success: true,
    classes: [],
    unconverted: [],
    selector: rule.selector,
    selectorInfo: rule.selectorInfo,
    pseudoPrefix: '',
  };
  
  // Handle pseudo-classes
  if (rule.selectorInfo && rule.selectorInfo.pseudoClasses.length > 0) {
    result.pseudoPrefix = mapPseudoClasses(rule.selectorInfo.pseudoClasses);
  }
  
  // Convert each declaration
  for (const decl of rule.declarations) {
    const conversion = convertDeclaration(decl.property, decl.value);
    
    if (conversion.success) {
      // Add pseudo-class prefix to each class
      const prefixedClasses = conversion.classes.map(c => {
        if (result.pseudoPrefix) {
          return `${result.pseudoPrefix}:${c}`;
        }
        return c;
      });
      result.classes.push(...prefixedClasses);
    } else {
      result.unconverted.push(decl);
    }
  }
  
  // If any declarations couldn't be converted, mark as partial success
  if (result.unconverted.length > 0) {
    result.success = result.classes.length > 0 ? 'partial' : false;
  }
  
  return result;
}

/**
 * Map CSS pseudo-classes to Tailwind variants
 * @param {Array} pseudoClasses - Array of pseudo-class names
 * @returns {string} Combined Tailwind variant prefix
 */
function mapPseudoClasses(pseudoClasses) {
  const variantMap = {
    'hover': 'hover',
    'focus': 'focus',
    'active': 'active',
    'visited': 'visited',
    'disabled': 'disabled',
    'enabled': 'enabled',
    'checked': 'checked',
    'first-child': 'first',
    'last-child': 'last',
    'odd': 'odd',
    'even': 'even',
    'focus-within': 'focus-within',
    'focus-visible': 'focus-visible',
    'empty': 'empty',
    'required': 'required',
    'invalid': 'invalid',
    'valid': 'valid',
    'placeholder-shown': 'placeholder-shown',
    'autofill': 'autofill',
    'read-only': 'read-only',
    'indeterminate': 'indeterminate',
    'default': 'default',
  };
  
  const variants = pseudoClasses
    .map(pc => variantMap[pc] || pc)
    .filter(Boolean);
  
  return variants.join(':');
}

/**
 * Convert multiple CSS rules and aggregate by class name
 * @param {Array} rules - Array of parsed CSS rules
 * @returns {Object} Map of class names to their Tailwind classes
 */
export function convertRules(rules) {
  const classMap = new Map();
  const unconvertedRules = [];
  const classesInUnconvertedRules = new Set();
  
  for (const rule of rules) {
    // Skip non-convertible rules
    if (rule.type === 'atrule' || !rule.isConvertible) {
      unconvertedRules.push(rule);
      // Track class names referenced by unconverted rules (e.g., scrollbar pseudo-elements)
      if (rule.selectorInfo && rule.selectorInfo.classes) {
        for (const className of rule.selectorInfo.classes) {
          classesInUnconvertedRules.add(className);
        }
      }
      continue;
    }
    
    const conversion = convertRule(rule);
    
    if (conversion.success === false) {
      unconvertedRules.push(rule);
      // Track class names referenced by unconverted rules
      if (rule.selectorInfo && rule.selectorInfo.classes) {
        for (const className of rule.selectorInfo.classes) {
          classesInUnconvertedRules.add(className);
        }
      }
      continue;
    }
    
    // Get the main class name (without pseudo-class)
    const mainClass = rule.selectorInfo.classes[0];
    if (!mainClass) continue;
    
    if (!classMap.has(mainClass)) {
      classMap.set(mainClass, {
        baseClasses: [],
        variantClasses: [],
        unconverted: [],
        originalRules: [], // Store original rules for dynamic class CSS preservation
      });
    }
    
    const entry = classMap.get(mainClass);
    
    // Store the original rule for potential preservation (e.g., dynamic classes in :class bindings)
    entry.originalRules.push(rule);
    
    // Add classes
    if (rule.selectorInfo.pseudoClasses.length > 0) {
      entry.variantClasses.push(...conversion.classes);
    } else {
      entry.baseClasses.push(...conversion.classes);
    }
    
    // Track unconverted declarations for this class
    if (conversion.unconverted.length > 0) {
      entry.unconverted.push({
        selector: rule.selector,
        declarations: conversion.unconverted,
      });
    }
  }
  
  return {
    classMap,
    unconvertedRules,
    classesInUnconvertedRules,
  };
}

/**
 * Get all Tailwind classes for a CSS class name
 * @param {Map} classMap - Map from convertRules
 * @param {string} className - CSS class name
 * @returns {Array} Array of Tailwind classes
 */
export function getClassesForSelector(classMap, className) {
  const entry = classMap.get(className);
  if (!entry) return [];
  
  return [...entry.baseClasses, ...entry.variantClasses];
}

/**
 * Generate CSS for unconverted declarations
 * @param {Map} classMap - Map from convertRules
 * @param {Array} unconvertedRules - Rules that couldn't be converted at all
 * @param {Set} dynamicClasses - Classes used in :class bindings that need full CSS preserved
 * @returns {string} CSS string for remaining styles
 */
export function generateUnconvertedCss(classMap, unconvertedRules, dynamicClasses = new Set()) {
  const lines = [];
  
  // Generate CSS for partially converted rules
  for (const [className, entry] of classMap) {
    if (entry.unconverted.length === 0) continue;
    
    for (const { selector, declarations } of entry.unconverted) {
      lines.push(`${selector} {`);
      for (const decl of declarations) {
        const important = decl.important ? ' !important' : '';
        lines.push(`  ${decl.property}: ${decl.value}${important};`);
      }
      lines.push('}');
      lines.push('');
    }
  }
  
  // Generate FULL CSS for dynamic classes (used in :class bindings)
  // These classes need their complete CSS preserved since they're applied dynamically
  for (const [className, entry] of classMap) {
    if (!dynamicClasses.has(className)) continue;
    if (!entry.originalRules) continue;
    
    for (const originalRule of entry.originalRules) {
      if (originalRule.source) {
        lines.push(originalRule.source);
        lines.push('');
      }
    }
  }
  
  // Add completely unconverted rules
  for (const rule of unconvertedRules) {
    if (rule.source) {
      lines.push(rule.source);
      lines.push('');
    }
  }
  
  return lines.join('\n').trim();
}

/**
 * Check if a CSS property-value pair is likely to need special handling
 * @param {string} property - CSS property
 * @param {string} value - CSS value
 * @returns {Object} Analysis of the declaration
 */
export function analyzeDeclaration(property, value) {
  return {
    hasVariable: value.includes('var('),
    hasCalc: value.includes('calc('),
    hasUrl: value.includes('url('),
    hasGradient: /gradient\(/.test(value),
    hasMultipleValues: value.split(',').length > 1,
    isComplex: /calc\(|var\(|url\(|gradient\(/.test(value),
  };
}

export default {
  convertDeclaration,
  convertRule,
  convertRules,
  getClassesForSelector,
  generateUnconvertedCss,
  analyzeDeclaration,
};

