/**
 * Template Transformer
 * 
 * Applies Tailwind classes to Vue template elements based on their CSS classes.
 */

import MagicString from 'magic-string';

/**
 * Transform a Vue template by adding Tailwind classes to elements
 * @param {string} template - Template content
 * @param {Map} classMap - Map of CSS class names to Tailwind classes
 * @param {Set} classesInUnconvertedRules - Classes referenced by unconverted rules (e.g., scrollbar pseudo-elements)
 * @returns {Object} Transformed template and statistics
 */
export function transformTemplate(template, classMap, classesInUnconvertedRules = new Set()) {
  const s = new MagicString(template);
  const stats = {
    elementsUpdated: 0,
    classesAdded: 0,
    classesProcessed: [],
  };
  
  // Find all elements with class attributes
  // Use a more robust approach that handles > characters inside attribute values
  // Non-greedy matching (*?) allows backtracking to find class= even when preceded by other content
  const classAttrRegex = /(<[a-zA-Z][a-zA-Z0-9-]*\s+)((?:[^>"']*?(?:"[^"]*"|'[^']*'))*?[^>"']*?)(\bclass\s*=\s*)(["'])([^"']*)\4((?:[^>"']*(?:"[^"]*"|'[^']*'))*[^>"']*>)/g;
  
  let match;
  const replacements = [];
  
  while ((match = classAttrRegex.exec(template)) !== null) {
    const [fullMatch, tagStart, beforeClass, classAttr, quote, classValue, afterClass] = match;
    const startIndex = match.index;
    
    // Parse existing classes
    const existingClasses = classValue.split(/\s+/).filter(Boolean);
    const newClasses = [];
    const remainingClasses = [];
    
    for (const className of existingClasses) {
      const entry = getClassMapEntry(classMap, className);
      
      if (entry) {
        // This class was processed by the converter
        const tailwindClasses = [...entry.baseClasses, ...entry.variantClasses];
        
        if (tailwindClasses.length > 0) {
          // Add Tailwind classes
          newClasses.push(...tailwindClasses);
          stats.classesProcessed.push(className);
        }
        
        // Keep the original CSS class if:
        // 1. It has unconverted properties (partial conversion)
        // 2. OR it's referenced by unconverted rules (e.g., scrollbar pseudo-elements)
        if (entry.unconverted.length > 0 || classesInUnconvertedRules.has(className)) {
          remainingClasses.push(className);
        }
        // If fully converted AND not referenced elsewhere, don't keep the CSS class
      } else {
        // Class not in our conversion map - keep it as-is
        // (it might be defined elsewhere: global CSS, external library, etc.)
        remainingClasses.push(className);
      }
    }
    
    if (newClasses.length > 0) {
      // Combine remaining CSS classes with new Tailwind classes
      // Deduplicate and maintain order
      const allClasses = [...new Set([...remainingClasses, ...newClasses])];
      const newClassValue = allClasses.join(' ');
      
      replacements.push({
        start: startIndex,
        end: startIndex + fullMatch.length,
        newContent: `${tagStart}${beforeClass}${classAttr}${quote}${newClassValue}${quote}${afterClass}`,
      });
      
      stats.elementsUpdated++;
      stats.classesAdded += newClasses.length;
    }
  }
  
  // Apply replacements in reverse order to maintain correct indices
  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, newContent } of replacements) {
    s.overwrite(start, end, newContent);
  }
  
  return {
    template: s.toString(),
    stats,
    hasChanges: replacements.length > 0,
  };
}

/**
 * Get the class map entry for a CSS class name
 * @param {Map} classMap - Map from converter
 * @param {string} className - CSS class name
 * @returns {Object|null} Class map entry or null
 */
function getClassMapEntry(classMap, className) {
  return classMap.get(className) || null;
}

/**
 * Get Tailwind classes for a CSS class name from the class map
 * @param {Map} classMap - Map from converter
 * @param {string} className - CSS class name
 * @returns {Array} Tailwind classes
 */
function getTailwindClassesForCssClass(classMap, className) {
  const entry = classMap.get(className);
  if (!entry) return [];
  
  return [...entry.baseClasses, ...entry.variantClasses];
}

/**
 * Transform a Vue SFC by updating template and style blocks
 * @param {string} source - Original Vue file content
 * @param {Object} parseResult - Parsed SFC result
 * @param {Map} classMap - Map of CSS class names to Tailwind classes
 * @param {string} remainingCss - CSS that couldn't be converted
 * @param {number} scopedStyleCount - Number of scoped style blocks to process
 * @param {Set} classesInUnconvertedRules - Classes referenced by unconverted rules
 * @returns {Object} Transformed file content and statistics
 */
export function transformVueSfc(source, parseResult, classMap, remainingCss, scopedStyleCount = 1, classesInUnconvertedRules = new Set()) {
  const s = new MagicString(source);
  const stats = {
    templateStats: null,
    stylesRemoved: false,
    stylesUpdated: false,
  };
  
  // Find and transform template
  // Use the parsed template info from @vue/compiler-sfc which correctly handles nested <template> tags
  if (parseResult.template) {
    const templateContent = parseResult.template.content;
    const templateLoc = parseResult.template.loc;
    
    // The loc points to the content between <template> and </template> tags
    const templateStart = templateLoc.start.offset;
    const templateEnd = templateLoc.end.offset;
    
    const { template: transformedContent, stats: tStats, hasChanges } = transformTemplate(templateContent, classMap, classesInUnconvertedRules);
    stats.templateStats = tStats;
    
    if (hasChanges) {
      // Only overwrite the content, not the tags
      s.overwrite(templateStart, templateEnd, transformedContent);
    }
  }
  
  // Find all style blocks
  const styleRegex = /<style(\s[^>]*)?>[\s\S]*?<\/style>/g;
  const styleMatches = [];
  let styleMatch;
  
  while ((styleMatch = styleRegex.exec(source)) !== null) {
    const attrs = styleMatch[1] || '';
    const isScoped = attrs.includes('scoped');
    styleMatches.push({
      start: styleMatch.index,
      end: styleMatch.index + styleMatch[0].length,
      content: styleMatch[0],
      attrs,
      isScoped,
    });
  }
  
  // Process style blocks (in reverse order for correct indexing)
  // Only modify scoped style blocks - leave non-scoped (global) styles untouched
  let scopedProcessed = 0;
  for (let i = styleMatches.length - 1; i >= 0; i--) {
    const { start, end, content, attrs, isScoped } = styleMatches[i];
    
    // Skip non-scoped styles - they're global styles that should be preserved
    if (!isScoped) {
      continue;
    }
    
    scopedProcessed++;
    
    if (remainingCss.trim()) {
      // Update with remaining CSS
      const newStyle = `<style${attrs}>\n${remainingCss}\n</style>`;
      s.overwrite(start, end, newStyle);
      stats.stylesUpdated = true;
    } else {
      // Remove empty style block
      s.remove(start, end);
      stats.stylesRemoved = true;
    }
  }
  
  // Clean up any extra blank lines
  let result = s.toString();
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return {
    content: result,
    stats,
  };
}

/**
 * Remove CSS class selectors that have been fully converted
 * @param {string} css - Original CSS content
 * @param {Set} convertedClasses - Set of fully converted class names
 * @returns {string} CSS with converted rules removed
 */
export function removeConvertedCss(css, convertedClasses) {
  if (!css || convertedClasses.size === 0) return css;
  
  const lines = css.split('\n');
  const result = [];
  let inConvertedBlock = false;
  let braceCount = 0;
  
  for (const line of lines) {
    // Check if this line starts a selector we've converted
    const selectorMatch = line.match(/^\s*\.([a-zA-Z_-][a-zA-Z0-9_-]*)/);
    
    if (selectorMatch && !inConvertedBlock) {
      const className = selectorMatch[1];
      if (convertedClasses.has(className)) {
        inConvertedBlock = true;
        braceCount = 0;
      }
    }
    
    if (inConvertedBlock) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      
      if (braceCount <= 0) {
        inConvertedBlock = false;
      }
      continue; // Skip this line
    }
    
    result.push(line);
  }
  
  return result.join('\n').trim();
}

/**
 * Generate a summary of the transformation
 * @param {Object} stats - Transformation statistics
 * @returns {string} Human-readable summary
 */
export function generateSummary(stats) {
  const lines = ['Transformation Summary:', ''];
  
  if (stats.templateStats) {
    lines.push(`  Template:`);
    lines.push(`    - Elements updated: ${stats.templateStats.elementsUpdated}`);
    lines.push(`    - Classes added: ${stats.templateStats.classesAdded}`);
    if (stats.templateStats.classesProcessed.length > 0) {
      lines.push(`    - CSS classes processed: ${stats.templateStats.classesProcessed.join(', ')}`);
    }
  }
  
  lines.push(`  Styles:`);
  if (stats.stylesRemoved) {
    lines.push(`    - Style block removed (all CSS converted)`);
  } else if (stats.stylesUpdated) {
    lines.push(`    - Style block updated (unconvertible CSS preserved)`);
  } else {
    lines.push(`    - No style changes needed`);
  }
  
  return lines.join('\n');
}

/**
 * Format Tailwind classes for readability
 * @param {Array} classes - Array of Tailwind classes
 * @param {Object} options - Formatting options
 * @returns {string} Formatted class string
 */
export function formatClasses(classes, options = {}) {
  const { 
    maxLineLength = 80,
    indent = '  ',
    sortClasses = true,
  } = options;
  
  if (sortClasses) {
    // Sort by category: layout > spacing > sizing > typography > colors > effects
    classes = [...classes].sort(sortTailwindClasses);
  }
  
  const classString = classes.join(' ');
  
  if (classString.length <= maxLineLength) {
    return classString;
  }
  
  // Break into multiple lines if too long
  const lines = [];
  let currentLine = '';
  
  for (const cls of classes) {
    if (currentLine.length + cls.length + 1 > maxLineLength) {
      lines.push(currentLine.trim());
      currentLine = indent + cls;
    } else {
      currentLine += (currentLine ? ' ' : '') + cls;
    }
  }
  
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  
  return lines.join('\n');
}

/**
 * Sort Tailwind classes by category
 * @param {string} a - First class
 * @param {string} b - Second class
 * @returns {number} Sort order
 */
function sortTailwindClasses(a, b) {
  const categoryOrder = [
    // Layout
    /^(flex|grid|block|inline|hidden|contents|table)/,
    /^(flex-|grid-|order-|col-|row-)/,
    /^(justify-|items-|content-|place-|self-)/,
    // Position
    /^(static|fixed|absolute|relative|sticky)/,
    /^(inset|top|right|bottom|left|z-)/,
    // Sizing
    /^(w-|h-|min-|max-|size-)/,
    // Spacing
    /^(p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|gap-|space-)/,
    // Typography
    /^(text-|font-|leading-|tracking-|align-)/,
    /^(uppercase|lowercase|capitalize|normal-case)/,
    /^(underline|overline|line-through|no-underline)/,
    // Colors/Background
    /^(bg-|from-|via-|to-)/,
    /^(border|rounded|ring|outline)/,
    // Effects
    /^(shadow|opacity|blur|brightness|contrast)/,
    // Transitions
    /^(transition|duration|delay|ease|animate)/,
    // Interactivity
    /^(cursor-|pointer-events|select-|resize|scroll)/,
    // Variants
    /^(hover:|focus:|active:|disabled:|first:|last:|odd:|even:)/,
  ];
  
  const getOrder = (cls) => {
    for (let i = 0; i < categoryOrder.length; i++) {
      if (categoryOrder[i].test(cls)) return i;
    }
    return categoryOrder.length;
  };
  
  return getOrder(a) - getOrder(b);
}

export default {
  transformTemplate,
  transformVueSfc,
  removeConvertedCss,
  generateSummary,
  formatClasses,
};

