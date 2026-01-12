/**
 * Vue SFC and CSS Parser
 * 
 * Handles parsing of Vue Single File Components and CSS extraction.
 */

import { parse as parseSfc } from '@vue/compiler-sfc';
import postcss from 'postcss';

/**
 * Parse a Vue SFC file content
 * @param {string} source - The Vue file content
 * @param {string} filename - The filename for error messages
 * @returns {Object} Parsed SFC descriptor with template, script, and styles
 */
export function parseVueSfc(source, filename = 'component.vue') {
  const { descriptor, errors } = parseSfc(source, {
    filename,
    sourceMap: false,
  });

  if (errors.length > 0) {
    console.warn(`Parse warnings for ${filename}:`, errors);
  }

  return {
    template: descriptor.template,
    script: descriptor.script,
    scriptSetup: descriptor.scriptSetup,
    styles: descriptor.styles,
    customBlocks: descriptor.customBlocks,
    source,
  };
}

/**
 * Parse CSS content and extract rules
 * @param {string} css - The CSS content
 * @returns {Object} Parsed CSS AST
 */
export function parseCss(css) {
  try {
    return postcss.parse(css);
  } catch (error) {
    console.error('CSS Parse Error:', error.message);
    return null;
  }
}

/**
 * Extract class selectors from a CSS selector string
 * @param {string} selector - CSS selector string
 * @returns {Object} Parsed selector info
 */
export function parseSelector(selector) {
  const result = {
    original: selector,
    classes: [],
    pseudoClasses: [],
    pseudoElements: [],
    isSimple: true,
    isConvertible: true,
  };

  // Check for pseudo-elements (includes vendor prefixes like ::-webkit-scrollbar)
  // Must check BEFORE general :: check
  if (selector.includes('::')) {
    result.isSimple = false;
    result.isConvertible = false;
    const pseudoElementMatch = selector.match(/::(-?[a-zA-Z][a-zA-Z0-9-]*)/g);
    if (pseudoElementMatch) {
      result.pseudoElements = pseudoElementMatch.map(p => p.slice(2));
    }
    return result;
  }

  // Check for attribute selectors - these can't be converted
  if (selector.includes('[')) {
    result.isSimple = false;
    result.isConvertible = false;
    // Still extract classes for reference
    const classMatches = selector.match(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g);
    if (classMatches) {
      result.classes = classMatches.map(c => c.slice(1));
    }
    return result;
  }

  // Check for complex selectors that can't be easily converted
  if (
    (selector.includes(' ') && !selector.includes(':')) || // Descendant selectors (but not .class:hover)
    selector.includes('>') ||   // Child selectors
    selector.includes('+') ||   // Adjacent sibling
    selector.includes('~')      // General sibling
  ) {
    result.isSimple = false;
    result.isConvertible = false;
  }

  // Extract pseudo-classes (only the ones Tailwind supports as variants)
  const pseudoClassMatch = selector.match(/:(?!:)(hover|focus|active|visited|disabled|enabled|checked|first-child|last-child|nth-child\([^)]+\)|focus-within|focus-visible|first|last|only|odd|even|empty|required|invalid|valid|placeholder-shown|autofill|read-only|indeterminate|default)/g);
  if (pseudoClassMatch) {
    result.pseudoClasses = pseudoClassMatch.map(p => p.slice(1)); // Remove leading :
  }

  // Extract class names
  const classMatches = selector.match(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g);
  if (classMatches) {
    result.classes = classMatches.map(c => c.slice(1)); // Remove leading .
  }

  // Handle compound selectors like .btn:hover (single class with pseudo-class)
  if (result.classes.length === 1 && result.pseudoClasses.length > 0 && result.isConvertible) {
    result.isSimple = true;
  }

  // If no class found, it's not convertible (e.g., element selectors like `to`, `from`)
  if (result.classes.length === 0) {
    result.isConvertible = false;
  }

  return result;
}

/**
 * Extract all CSS rules from a style block
 * @param {string} css - CSS content
 * @returns {Array} Array of rule objects
 */
export function extractCssRules(css) {
  const ast = parseCss(css);
  if (!ast) return [];

  const rules = [];
  const processedAtRules = new Set();

  // First, capture all @-rules (keyframes, media, etc.) as complete blocks
  ast.walkAtRules((atRule) => {
    // Skip if already processed
    if (processedAtRules.has(atRule)) return;
    processedAtRules.add(atRule);

    // These are always kept as-is (not convertible)
    if (atRule.name === 'keyframes' || atRule.name === 'font-face' || atRule.name === 'import' || atRule.name === 'media') {
      rules.push({
        type: 'atrule',
        name: atRule.name,
        params: atRule.params,
        isConvertible: false,
        source: atRule.toString(),
      });
    }
  });

  // Then process regular rules (but skip those inside @-rules)
  ast.walkRules((rule) => {
    // Skip rules inside @keyframes, @media, etc.
    if (rule.parent && rule.parent.type === 'atrule') {
      return; // Already captured as part of the @-rule block
    }

    const selectorInfo = parseSelector(rule.selector);
    const declarations = extractDeclarations(rule);

    rules.push({
      type: 'rule',
      selector: rule.selector,
      selectorInfo,
      declarations,
      isConvertible: selectorInfo.isConvertible,
      source: rule.toString(),
    });
  });

  return rules;
}

/**
 * Extract declarations from a CSS rule
 * @param {Object} rule - PostCSS rule node
 * @returns {Array} Array of declaration objects
 */
function extractDeclarations(rule) {
  const declarations = [];

  rule.walkDecls((decl) => {
    declarations.push({
      property: decl.prop,
      value: decl.value,
      important: decl.important,
    });
  });

  return declarations;
}

/**
 * Parse HTML/Vue template to find elements with specific classes
 * @param {string} template - Template content
 * @returns {Map} Map of class names to their element locations
 */
export function parseTemplate(template) {
  const classLocations = new Map();
  
  // Match class attributes in the template
  // Handles: class="foo bar", :class="...", class='foo'
  const classAttrRegex = /\bclass\s*=\s*["']([^"']+)["']/g;
  
  let match;
  while ((match = classAttrRegex.exec(template)) !== null) {
    const classes = match[1].split(/\s+/).filter(Boolean);
    const startIndex = match.index;
    const fullMatch = match[0];
    
    for (const className of classes) {
      if (!classLocations.has(className)) {
        classLocations.set(className, []);
      }
      classLocations.get(className).push({
        start: startIndex,
        end: startIndex + fullMatch.length,
        fullMatch,
        allClasses: classes,
      });
    }
  }
  
  return classLocations;
}

/**
 * Extract class names used in Vue :class bindings
 * These classes need their CSS preserved since they're applied dynamically
 * @param {string} template - Template content
 * @returns {Set} Set of class names used in :class bindings
 */
export function extractDynamicClasses(template) {
  const dynamicClasses = new Set();
  
  // Match :class bindings with object syntax: :class="{ 'class-name': condition }"
  // Also handles v-bind:class
  const bindingRegex = /(?::|v-bind:)class\s*=\s*["']?\{([^}]+)\}["']?/g;
  
  let match;
  while ((match = bindingRegex.exec(template)) !== null) {
    const bindingContent = match[1];
    
    // Extract class names from object keys: 'class-name': condition or "class-name": condition
    const classRegex = /['"]([a-zA-Z_-][a-zA-Z0-9_-]*)['"](?:\s*:)/g;
    let classMatch;
    while ((classMatch = classRegex.exec(bindingContent)) !== null) {
      dynamicClasses.add(classMatch[1]);
    }
  }
  
  // Match :class with array syntax: :class="['class-name', ...]"
  const arrayRegex = /(?::|v-bind:)class\s*=\s*["']?\[([^\]]+)\]["']?/g;
  while ((match = arrayRegex.exec(template)) !== null) {
    const arrayContent = match[1];
    
    // Extract string class names
    const stringClassRegex = /['"]([a-zA-Z_-][a-zA-Z0-9_-]*)['"]/g;
    let classMatch;
    while ((classMatch = stringClassRegex.exec(arrayContent)) !== null) {
      dynamicClasses.add(classMatch[1]);
    }
  }
  
  return dynamicClasses;
}

/**
 * Find element tags that have a specific class
 * @param {string} template - Template content
 * @param {string} className - Class name to find
 * @returns {Array} Array of element info objects
 */
export function findElementsWithClass(template, className) {
  const elements = [];
  
  // Regex to find opening tags with class attributes
  // This is a simplified regex - a proper HTML parser would be more robust
  const tagRegex = /<([a-zA-Z][a-zA-Z0-9-]*)\s+([^>]*\bclass\s*=\s*["'][^"']*\b${escapeRegex(className)}\b[^"']*["'][^>]*)>/g;
  
  let match;
  while ((match = tagRegex.exec(template)) !== null) {
    const tagName = match[1];
    const attributes = match[2];
    
    elements.push({
      tagName,
      attributes,
      fullMatch: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  
  return elements;
}

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get the position info for reconstructing the Vue file
 * @param {Object} descriptor - Parsed SFC descriptor
 * @param {string} source - Original source
 * @returns {Object} Position information for each block
 */
export function getBlockPositions(descriptor, source) {
  const positions = {};
  
  if (descriptor.template) {
    const templateMatch = source.match(/<template(\s[^>]*)?>[\s\S]*?<\/template>/);
    if (templateMatch) {
      positions.template = {
        start: templateMatch.index,
        end: templateMatch.index + templateMatch[0].length,
        content: templateMatch[0],
      };
    }
  }
  
  if (descriptor.script || descriptor.scriptSetup) {
    const scriptMatch = source.match(/<script(\s[^>]*)?>[\s\S]*?<\/script>/);
    if (scriptMatch) {
      positions.script = {
        start: scriptMatch.index,
        end: scriptMatch.index + scriptMatch[0].length,
        content: scriptMatch[0],
      };
    }
  }
  
  // Find all style blocks
  const styleRegex = /<style(\s[^>]*)?>[\s\S]*?<\/style>/g;
  positions.styles = [];
  let styleMatch;
  while ((styleMatch = styleRegex.exec(source)) !== null) {
    positions.styles.push({
      start: styleMatch.index,
      end: styleMatch.index + styleMatch[0].length,
      content: styleMatch[0],
    });
  }
  
  return positions;
}

export default {
  parseVueSfc,
  parseCss,
  parseSelector,
  extractCssRules,
  parseTemplate,
  findElementsWithClass,
  getBlockPositions,
};

