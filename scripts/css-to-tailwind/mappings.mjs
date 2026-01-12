/**
 * CSS Property to Tailwind Class Mappings
 * 
 * This file contains comprehensive mappings from CSS properties and values
 * to their Tailwind CSS v4 equivalents.
 */

// Spacing scale (rem to Tailwind spacing units)
const spacingScale = {
  '0': '0',
  '0px': '0',
  '0.125rem': '0.5',
  '2px': '0.5',
  '0.25rem': '1',
  '4px': '1',
  '0.375rem': '1.5',
  '6px': '1.5',
  '0.5rem': '2',
  '8px': '2',
  '0.625rem': '2.5',
  '10px': '2.5',
  '0.75rem': '3',
  '12px': '3',
  '0.875rem': '3.5',
  '14px': '3.5',
  '1rem': '4',
  '16px': '4',
  '1.25rem': '5',
  '20px': '5',
  '1.5rem': '6',
  '24px': '6',
  '1.75rem': '7',
  '28px': '7',
  '2rem': '8',
  '32px': '8',
  '2.25rem': '9',
  '36px': '9',
  '2.5rem': '10',
  '40px': '10',
  '2.75rem': '11',
  '44px': '11',
  '3rem': '12',
  '48px': '12',
  '3.5rem': '14',
  '56px': '14',
  '4rem': '16',
  '64px': '16',
  '5rem': '20',
  '80px': '20',
  '6rem': '24',
  '96px': '24',
  '7rem': '28',
  '112px': '28',
  '8rem': '32',
  '128px': '32',
  '9rem': '36',
  '144px': '36',
  '10rem': '40',
  '160px': '40',
  '11rem': '44',
  '176px': '44',
  '12rem': '48',
  '192px': '48',
  '13rem': '52',
  '208px': '52',
  '14rem': '56',
  '224px': '56',
  '15rem': '60',
  '240px': '60',
  '16rem': '64',
  '256px': '64',
  '18rem': '72',
  '288px': '72',
  '20rem': '80',
  '320px': '80',
  '24rem': '96',
  '384px': '96',
};

// Font size mappings
const fontSizeScale = {
  '0.625rem': 'xs',      // 10px
  '10px': 'xs',
  '0.75rem': 'xs',       // 12px
  '12px': 'xs',
  '0.8125rem': 'sm',     // 13px
  '13px': 'sm',
  '0.875rem': 'sm',      // 14px
  '14px': 'sm',
  '1rem': 'base',            // 16px
  '16px': 'base',
  '1.125rem': 'lg',          // 18px
  '18px': 'lg',
  '1.25rem': 'xl',           // 20px
  '20px': 'xl',
  '1.5rem': '2xl',           // 24px
  '24px': '2xl',
  '1.875rem': '3xl',         // 30px
  '30px': '3xl',
  '2.25rem': '4xl',          // 36px
  '36px': '4xl',
  '3rem': '5xl',             // 48px
  '48px': '5xl',
  '3.75rem': '6xl',          // 60px
  '60px': '6xl',
  '4.5rem': '7xl',           // 72px
  '72px': '7xl',
  '6rem': '8xl',             // 96px
  '96px': '8xl',
  '8rem': '9xl',             // 128px
  '128px': '9xl',
};

// Font weight mappings
const fontWeightScale = {
  '100': 'thin',
  '200': 'extralight',
  '300': 'light',
  '400': 'normal',
  '500': 'medium',
  '600': 'semibold',
  '700': 'bold',
  '800': 'extrabold',
  '900': 'black',
};

// Border radius mappings
const borderRadiusScale = {
  '0': 'none',
  '0px': 'none',
  '0.125rem': 'sm',
  '2px': 'sm',
  '0.25rem': 'DEFAULT',
  '4px': 'DEFAULT',
  '0.375rem': 'md',
  '6px': 'md',
  '0.5rem': 'lg',
  '8px': 'lg',
  '0.75rem': 'xl',
  '12px': 'xl',
  '1rem': '2xl',
  '16px': '2xl',
  '1.5rem': '3xl',
  '24px': '3xl',
  '9999px': 'full',
  '50%': 'full',
};

// Line height mappings
const lineHeightScale = {
  '1': 'none',
  '1.25': 'tight',
  '1.375': 'snug',
  '1.5': 'normal',
  '1.625': 'relaxed',
  '2': 'loose',
  '0.75rem': '3',
  '1rem': '4',
  '1.25rem': '5',
  '1.5rem': '6',
  '1.75rem': '7',
  '2rem': '8',
  '2.25rem': '9',
  '2.5rem': '10',
};

// Opacity mappings
const opacityScale = {
  '0': '0',
  '0.05': '5',
  '0.1': '10',
  '0.15': '15',
  '0.2': '20',
  '0.25': '25',
  '0.3': '30',
  '0.35': '35',
  '0.4': '40',
  '0.45': '45',
  '0.5': '50',
  '0.55': '55',
  '0.6': '60',
  '0.65': '65',
  '0.7': '70',
  '0.75': '75',
  '0.8': '80',
  '0.85': '85',
  '0.9': '90',
  '0.95': '95',
  '1': '100',
};

// Z-index mappings
const zIndexScale = {
  '0': '0',
  '10': '10',
  '20': '20',
  '30': '30',
  '40': '40',
  '50': '50',
  'auto': 'auto',
};

// Transition duration mappings
const durationScale = {
  '0ms': '0',
  '0s': '0',
  '75ms': '75',
  '100ms': '100',
  '150ms': '150',
  '200ms': '200',
  '300ms': '300',
  '500ms': '500',
  '700ms': '700',
  '1000ms': '1000',
  '1s': '1000',
};

// Timing function mappings
// Note: 'ease' is the CSS default, Tailwind doesn't have an 'ease-ease' class
const easingScale = {
  'linear': 'linear',
  'ease': null,  // Skip - ease is the default, no class needed
  'ease-in': 'in',
  'ease-out': 'out',
  'ease-in-out': 'in-out',
};

// Common color mappings (named colors to Tailwind)
const namedColors = {
  'transparent': 'transparent',
  'currentColor': 'current',
  'current': 'current',
  'inherit': 'inherit',
  'white': 'white',
  'black': 'black',
  'red': 'red-500',
  'green': 'green-500',
  'blue': 'blue-500',
  'yellow': 'yellow-500',
  'purple': 'purple-500',
  'pink': 'pink-500',
  'gray': 'gray-500',
  'grey': 'gray-500',
  'orange': 'orange-500',
  'cyan': 'cyan-500',
  'teal': 'teal-500',
};

/**
 * Direct CSS property-value to Tailwind class mappings
 */
export const directMappings = {
  // Display
  'display: flex': 'flex',
  'display: inline-flex': 'inline-flex',
  'display: block': 'block',
  'display: inline-block': 'inline-block',
  'display: inline': 'inline',
  'display: grid': 'grid',
  'display: inline-grid': 'inline-grid',
  'display: contents': 'contents',
  'display: none': 'hidden',
  'display: table': 'table',
  'display: table-row': 'table-row',
  'display: table-cell': 'table-cell',

  // Flex direction
  'flex-direction: row': 'flex-row',
  'flex-direction: row-reverse': 'flex-row-reverse',
  'flex-direction: column': 'flex-col',
  'flex-direction: column-reverse': 'flex-col-reverse',

  // Flex wrap
  'flex-wrap: wrap': 'flex-wrap',
  'flex-wrap: wrap-reverse': 'flex-wrap-reverse',
  'flex-wrap: nowrap': 'flex-nowrap',

  // Flex grow/shrink
  'flex-grow: 0': 'grow-0',
  'flex-grow: 1': 'grow',
  'flex-shrink: 0': 'shrink-0',
  'flex-shrink: 1': 'shrink',
  'flex: 1': 'flex-1',
  'flex: 1 1 0%': 'flex-1',
  'flex: auto': 'flex-auto',
  'flex: 1 1 auto': 'flex-auto',
  'flex: initial': 'flex-initial',
  'flex: 0 1 auto': 'flex-initial',
  'flex: none': 'flex-none',
  'flex: 0 0 auto': 'flex-none',

  // Align items
  'align-items: flex-start': 'items-start',
  'align-items: flex-end': 'items-end',
  'align-items: center': 'items-center',
  'align-items: baseline': 'items-baseline',
  'align-items: stretch': 'items-stretch',

  // Align self
  'align-self: auto': 'self-auto',
  'align-self: flex-start': 'self-start',
  'align-self: flex-end': 'self-end',
  'align-self: center': 'self-center',
  'align-self: stretch': 'self-stretch',
  'align-self: baseline': 'self-baseline',

  // Justify content
  'justify-content: flex-start': 'justify-start',
  'justify-content: flex-end': 'justify-end',
  'justify-content: center': 'justify-center',
  'justify-content: space-between': 'justify-between',
  'justify-content: space-around': 'justify-around',
  'justify-content: space-evenly': 'justify-evenly',
  'justify-content: stretch': 'justify-stretch',

  // Justify items
  'justify-items: start': 'justify-items-start',
  'justify-items: end': 'justify-items-end',
  'justify-items: center': 'justify-items-center',
  'justify-items: stretch': 'justify-items-stretch',

  // Justify self
  'justify-self: auto': 'justify-self-auto',
  'justify-self: start': 'justify-self-start',
  'justify-self: end': 'justify-self-end',
  'justify-self: center': 'justify-self-center',
  'justify-self: stretch': 'justify-self-stretch',

  // Align content
  'align-content: flex-start': 'content-start',
  'align-content: flex-end': 'content-end',
  'align-content: center': 'content-center',
  'align-content: space-between': 'content-between',
  'align-content: space-around': 'content-around',
  'align-content: space-evenly': 'content-evenly',
  'align-content: stretch': 'content-stretch',
  'align-content: baseline': 'content-baseline',

  // Place content
  'place-content: center': 'place-content-center',
  'place-content: start': 'place-content-start',
  'place-content: end': 'place-content-end',
  'place-content: space-between': 'place-content-between',
  'place-content: space-around': 'place-content-around',
  'place-content: space-evenly': 'place-content-evenly',
  'place-content: stretch': 'place-content-stretch',
  'place-content: baseline': 'place-content-baseline',

  // Place items
  'place-items: center': 'place-items-center',
  'place-items: start': 'place-items-start',
  'place-items: end': 'place-items-end',
  'place-items: stretch': 'place-items-stretch',
  'place-items: baseline': 'place-items-baseline',

  // Place self
  'place-self: auto': 'place-self-auto',
  'place-self: start': 'place-self-start',
  'place-self: end': 'place-self-end',
  'place-self: center': 'place-self-center',
  'place-self: stretch': 'place-self-stretch',

  // Position
  'position: static': 'static',
  'position: fixed': 'fixed',
  'position: absolute': 'absolute',
  'position: relative': 'relative',
  'position: sticky': 'sticky',

  // Visibility
  'visibility: visible': 'visible',
  'visibility: hidden': 'invisible',
  'visibility: collapse': 'collapse',

  // Overflow
  'overflow: auto': 'overflow-auto',
  'overflow: hidden': 'overflow-hidden',
  'overflow: clip': 'overflow-clip',
  'overflow: visible': 'overflow-visible',
  'overflow: scroll': 'overflow-scroll',
  'overflow-x: auto': 'overflow-x-auto',
  'overflow-x: hidden': 'overflow-x-hidden',
  'overflow-x: clip': 'overflow-x-clip',
  'overflow-x: visible': 'overflow-x-visible',
  'overflow-x: scroll': 'overflow-x-scroll',
  'overflow-y: auto': 'overflow-y-auto',
  'overflow-y: hidden': 'overflow-y-hidden',
  'overflow-y: clip': 'overflow-y-clip',
  'overflow-y: visible': 'overflow-y-visible',
  'overflow-y: scroll': 'overflow-y-scroll',

  // Overscroll behavior
  'overscroll-behavior: auto': 'overscroll-auto',
  'overscroll-behavior: contain': 'overscroll-contain',
  'overscroll-behavior: none': 'overscroll-none',
  'overscroll-behavior-x: auto': 'overscroll-x-auto',
  'overscroll-behavior-x: contain': 'overscroll-x-contain',
  'overscroll-behavior-x: none': 'overscroll-x-none',
  'overscroll-behavior-y: auto': 'overscroll-y-auto',
  'overscroll-behavior-y: contain': 'overscroll-y-contain',
  'overscroll-behavior-y: none': 'overscroll-y-none',

  // Float and clear
  'float: left': 'float-left',
  'float: right': 'float-right',
  'float: none': 'float-none',
  'float: start': 'float-start',
  'float: end': 'float-end',
  'clear: left': 'clear-left',
  'clear: right': 'clear-right',
  'clear: both': 'clear-both',
  'clear: none': 'clear-none',
  'clear: start': 'clear-start',
  'clear: end': 'clear-end',

  // Isolation
  'isolation: isolate': 'isolate',
  'isolation: auto': 'isolation-auto',

  // Object fit
  'object-fit: contain': 'object-contain',
  'object-fit: cover': 'object-cover',
  'object-fit: fill': 'object-fill',
  'object-fit: none': 'object-none',
  'object-fit: scale-down': 'object-scale-down',

  // Object position
  'object-position: bottom': 'object-bottom',
  'object-position: center': 'object-center',
  'object-position: left': 'object-left',
  'object-position: left bottom': 'object-left-bottom',
  'object-position: left top': 'object-left-top',
  'object-position: right': 'object-right',
  'object-position: right bottom': 'object-right-bottom',
  'object-position: right top': 'object-right-top',
  'object-position: top': 'object-top',

  // Text alignment
  'text-align: left': 'text-left',
  'text-align: center': 'text-center',
  'text-align: right': 'text-right',
  'text-align: justify': 'text-justify',
  'text-align: start': 'text-start',
  'text-align: end': 'text-end',

  // Vertical align
  'vertical-align: baseline': 'align-baseline',
  'vertical-align: top': 'align-top',
  'vertical-align: middle': 'align-middle',
  'vertical-align: bottom': 'align-bottom',
  'vertical-align: text-top': 'align-text-top',
  'vertical-align: text-bottom': 'align-text-bottom',
  'vertical-align: sub': 'align-sub',
  'vertical-align: super': 'align-super',

  // Font style
  'font-style: italic': 'italic',
  'font-style: normal': 'not-italic',

  // Text decoration
  'text-decoration: underline': 'underline',
  'text-decoration-line: underline': 'underline',
  'text-decoration: overline': 'overline',
  'text-decoration-line: overline': 'overline',
  'text-decoration: line-through': 'line-through',
  'text-decoration-line: line-through': 'line-through',
  'text-decoration: none': 'no-underline',
  'text-decoration-line: none': 'no-underline',

  // Text decoration style
  'text-decoration-style: solid': 'decoration-solid',
  'text-decoration-style: double': 'decoration-double',
  'text-decoration-style: dotted': 'decoration-dotted',
  'text-decoration-style: dashed': 'decoration-dashed',
  'text-decoration-style: wavy': 'decoration-wavy',

  // Text transform
  'text-transform: uppercase': 'uppercase',
  'text-transform: lowercase': 'lowercase',
  'text-transform: capitalize': 'capitalize',
  'text-transform: none': 'normal-case',

  // Text overflow
  'text-overflow: ellipsis': 'text-ellipsis',
  'text-overflow: clip': 'text-clip',

  // White space
  'white-space: normal': 'whitespace-normal',
  'white-space: nowrap': 'whitespace-nowrap',
  'white-space: pre': 'whitespace-pre',
  'white-space: pre-line': 'whitespace-pre-line',
  'white-space: pre-wrap': 'whitespace-pre-wrap',
  'white-space: break-spaces': 'whitespace-break-spaces',

  // Word break
  'word-break: normal': 'break-normal',
  'word-break: break-all': 'break-all',
  'word-break: keep-all': 'break-keep',
  'overflow-wrap: break-word': 'break-words',
  'word-wrap: break-word': 'break-words',

  // Hyphens
  'hyphens: none': 'hyphens-none',
  'hyphens: manual': 'hyphens-manual',
  'hyphens: auto': 'hyphens-auto',

  // List style type
  'list-style-type: none': 'list-none',
  'list-style-type: disc': 'list-disc',
  'list-style-type: decimal': 'list-decimal',

  // List style position
  'list-style-position: inside': 'list-inside',
  'list-style-position: outside': 'list-outside',

  // Cursor
  'cursor: auto': 'cursor-auto',
  'cursor: default': 'cursor-default',
  'cursor: pointer': 'cursor-pointer',
  'cursor: wait': 'cursor-wait',
  'cursor: text': 'cursor-text',
  'cursor: move': 'cursor-move',
  'cursor: help': 'cursor-help',
  'cursor: not-allowed': 'cursor-not-allowed',
  'cursor: none': 'cursor-none',
  'cursor: context-menu': 'cursor-context-menu',
  'cursor: progress': 'cursor-progress',
  'cursor: cell': 'cursor-cell',
  'cursor: crosshair': 'cursor-crosshair',
  'cursor: vertical-text': 'cursor-vertical-text',
  'cursor: alias': 'cursor-alias',
  'cursor: copy': 'cursor-copy',
  'cursor: no-drop': 'cursor-no-drop',
  'cursor: grab': 'cursor-grab',
  'cursor: grabbing': 'cursor-grabbing',
  'cursor: all-scroll': 'cursor-all-scroll',
  'cursor: col-resize': 'cursor-col-resize',
  'cursor: row-resize': 'cursor-row-resize',
  'cursor: n-resize': 'cursor-n-resize',
  'cursor: e-resize': 'cursor-e-resize',
  'cursor: s-resize': 'cursor-s-resize',
  'cursor: w-resize': 'cursor-w-resize',
  'cursor: ne-resize': 'cursor-ne-resize',
  'cursor: nw-resize': 'cursor-nw-resize',
  'cursor: se-resize': 'cursor-se-resize',
  'cursor: sw-resize': 'cursor-sw-resize',
  'cursor: ew-resize': 'cursor-ew-resize',
  'cursor: ns-resize': 'cursor-ns-resize',
  'cursor: nesw-resize': 'cursor-nesw-resize',
  'cursor: nwse-resize': 'cursor-nwse-resize',
  'cursor: zoom-in': 'cursor-zoom-in',
  'cursor: zoom-out': 'cursor-zoom-out',

  // Pointer events
  'pointer-events: none': 'pointer-events-none',
  'pointer-events: auto': 'pointer-events-auto',

  // Resize
  'resize: none': 'resize-none',
  'resize: vertical': 'resize-y',
  'resize: horizontal': 'resize-x',
  'resize: both': 'resize',

  // Scroll behavior
  'scroll-behavior: auto': 'scroll-auto',
  'scroll-behavior: smooth': 'scroll-smooth',

  // Scroll snap type
  'scroll-snap-type: none': 'snap-none',
  'scroll-snap-type: x mandatory': 'snap-x snap-mandatory',
  'scroll-snap-type: y mandatory': 'snap-y snap-mandatory',
  'scroll-snap-type: both mandatory': 'snap-both snap-mandatory',
  'scroll-snap-type: x proximity': 'snap-x',
  'scroll-snap-type: y proximity': 'snap-y',
  'scroll-snap-type: both proximity': 'snap-both',

  // Scroll snap align
  'scroll-snap-align: start': 'snap-start',
  'scroll-snap-align: end': 'snap-end',
  'scroll-snap-align: center': 'snap-center',
  'scroll-snap-align: none': 'snap-align-none',

  // Scroll snap stop
  'scroll-snap-stop: normal': 'snap-normal',
  'scroll-snap-stop: always': 'snap-always',

  // Touch action
  'touch-action: auto': 'touch-auto',
  'touch-action: none': 'touch-none',
  'touch-action: pan-x': 'touch-pan-x',
  'touch-action: pan-left': 'touch-pan-left',
  'touch-action: pan-right': 'touch-pan-right',
  'touch-action: pan-y': 'touch-pan-y',
  'touch-action: pan-up': 'touch-pan-up',
  'touch-action: pan-down': 'touch-pan-down',
  'touch-action: pinch-zoom': 'touch-pinch-zoom',
  'touch-action: manipulation': 'touch-manipulation',

  // User select
  'user-select: none': 'select-none',
  'user-select: text': 'select-text',
  'user-select: all': 'select-all',
  'user-select: auto': 'select-auto',

  // Will change
  'will-change: auto': 'will-change-auto',
  'will-change: scroll-position': 'will-change-scroll',
  'will-change: contents': 'will-change-contents',
  'will-change: transform': 'will-change-transform',

  // Box sizing
  'box-sizing: border-box': 'box-border',
  'box-sizing: content-box': 'box-content',

  // Border style
  'border-style: solid': 'border-solid',
  'border-style: dashed': 'border-dashed',
  'border-style: dotted': 'border-dotted',
  'border-style: double': 'border-double',
  'border-style: hidden': 'border-hidden',
  'border-style: none': 'border-none',

  // Outline style
  'outline-style: none': 'outline-none',
  'outline-style: solid': 'outline',
  'outline-style: dashed': 'outline-dashed',
  'outline-style: dotted': 'outline-dotted',
  'outline-style: double': 'outline-double',

  // Table layout
  'table-layout: auto': 'table-auto',
  'table-layout: fixed': 'table-fixed',

  // Caption side
  'caption-side: top': 'caption-top',
  'caption-side: bottom': 'caption-bottom',

  // Border collapse
  'border-collapse: collapse': 'border-collapse',
  'border-collapse: separate': 'border-separate',

  // Background attachment
  'background-attachment: fixed': 'bg-fixed',
  'background-attachment: local': 'bg-local',
  'background-attachment: scroll': 'bg-scroll',

  // Background clip
  'background-clip: border-box': 'bg-clip-border',
  'background-clip: padding-box': 'bg-clip-padding',
  'background-clip: content-box': 'bg-clip-content',
  'background-clip: text': 'bg-clip-text',
  '-webkit-background-clip: text': 'bg-clip-text',

  // Background origin
  'background-origin: border-box': 'bg-origin-border',
  'background-origin: padding-box': 'bg-origin-padding',
  'background-origin: content-box': 'bg-origin-content',

  // Background position
  'background-position: bottom': 'bg-bottom',
  'background-position: center': 'bg-center',
  'background-position: left': 'bg-left',
  'background-position: left bottom': 'bg-left-bottom',
  'background-position: left top': 'bg-left-top',
  'background-position: right': 'bg-right',
  'background-position: right bottom': 'bg-right-bottom',
  'background-position: right top': 'bg-right-top',
  'background-position: top': 'bg-top',

  // Background repeat
  'background-repeat: repeat': 'bg-repeat',
  'background-repeat: no-repeat': 'bg-no-repeat',
  'background-repeat: repeat-x': 'bg-repeat-x',
  'background-repeat: repeat-y': 'bg-repeat-y',
  'background-repeat: round': 'bg-repeat-round',
  'background-repeat: space': 'bg-repeat-space',

  // Background size
  'background-size: auto': 'bg-auto',
  'background-size: cover': 'bg-cover',
  'background-size: contain': 'bg-contain',

  // Mix blend mode
  'mix-blend-mode: normal': 'mix-blend-normal',
  'mix-blend-mode: multiply': 'mix-blend-multiply',
  'mix-blend-mode: screen': 'mix-blend-screen',
  'mix-blend-mode: overlay': 'mix-blend-overlay',
  'mix-blend-mode: darken': 'mix-blend-darken',
  'mix-blend-mode: lighten': 'mix-blend-lighten',
  'mix-blend-mode: color-dodge': 'mix-blend-color-dodge',
  'mix-blend-mode: color-burn': 'mix-blend-color-burn',
  'mix-blend-mode: hard-light': 'mix-blend-hard-light',
  'mix-blend-mode: soft-light': 'mix-blend-soft-light',
  'mix-blend-mode: difference': 'mix-blend-difference',
  'mix-blend-mode: exclusion': 'mix-blend-exclusion',
  'mix-blend-mode: hue': 'mix-blend-hue',
  'mix-blend-mode: saturation': 'mix-blend-saturation',
  'mix-blend-mode: color': 'mix-blend-color',
  'mix-blend-mode: luminosity': 'mix-blend-luminosity',
  'mix-blend-mode: plus-lighter': 'mix-blend-plus-lighter',

  // Background blend mode
  'background-blend-mode: normal': 'bg-blend-normal',
  'background-blend-mode: multiply': 'bg-blend-multiply',
  'background-blend-mode: screen': 'bg-blend-screen',
  'background-blend-mode: overlay': 'bg-blend-overlay',
  'background-blend-mode: darken': 'bg-blend-darken',
  'background-blend-mode: lighten': 'bg-blend-lighten',
  'background-blend-mode: color-dodge': 'bg-blend-color-dodge',
  'background-blend-mode: color-burn': 'bg-blend-color-burn',
  'background-blend-mode: hard-light': 'bg-blend-hard-light',
  'background-blend-mode: soft-light': 'bg-blend-soft-light',
  'background-blend-mode: difference': 'bg-blend-difference',
  'background-blend-mode: exclusion': 'bg-blend-exclusion',
  'background-blend-mode: hue': 'bg-blend-hue',
  'background-blend-mode: saturation': 'bg-blend-saturation',
  'background-blend-mode: color': 'bg-blend-color',
  'background-blend-mode: luminosity': 'bg-blend-luminosity',

  // Appearance
  'appearance: none': 'appearance-none',
  '-webkit-appearance: none': 'appearance-none',
  'appearance: auto': 'appearance-auto',

  // Caret color
  'caret-color: transparent': 'caret-transparent',
  'caret-color: currentColor': 'caret-current',

  // Accent color
  'accent-color: auto': 'accent-auto',
  'accent-color: inherit': 'accent-inherit',
  'accent-color: currentColor': 'accent-current',
  'accent-color: transparent': 'accent-transparent',

  // Width/Height special values
  'width: auto': 'w-auto',
  'width: 100%': 'w-full',
  'width: 100vw': 'w-screen',
  'width: 100svw': 'w-svw',
  'width: 100lvw': 'w-lvw',
  'width: 100dvw': 'w-dvw',
  'width: min-content': 'w-min',
  'width: max-content': 'w-max',
  'width: fit-content': 'w-fit',
  'height: auto': 'h-auto',
  'height: 100%': 'h-full',
  'height: 100vh': 'h-screen',
  'height: 100svh': 'h-svh',
  'height: 100lvh': 'h-lvh',
  'height: 100dvh': 'h-dvh',
  'height: min-content': 'h-min',
  'height: max-content': 'h-max',
  'height: fit-content': 'h-fit',

  // Min/Max dimensions
  'min-width: 0': 'min-w-0',
  'min-width: 100%': 'min-w-full',
  'min-width: min-content': 'min-w-min',
  'min-width: max-content': 'min-w-max',
  'min-width: fit-content': 'min-w-fit',
  'max-width: none': 'max-w-none',
  'max-width: 100%': 'max-w-full',
  'max-width: min-content': 'max-w-min',
  'max-width: max-content': 'max-w-max',
  'max-width: fit-content': 'max-w-fit',
  'min-height: 0': 'min-h-0',
  'min-height: 100%': 'min-h-full',
  'min-height: 100vh': 'min-h-screen',
  'min-height: 100svh': 'min-h-svh',
  'min-height: 100lvh': 'min-h-lvh',
  'min-height: 100dvh': 'min-h-dvh',
  'min-height: min-content': 'min-h-min',
  'min-height: max-content': 'min-h-max',
  'min-height: fit-content': 'min-h-fit',
  'max-height: none': 'max-h-none',
  'max-height: 100%': 'max-h-full',
  'max-height: 100vh': 'max-h-screen',
  'max-height: 100svh': 'max-h-svh',
  'max-height: 100lvh': 'max-h-lvh',
  'max-height: 100dvh': 'max-h-dvh',
  'max-height: min-content': 'max-h-min',
  'max-height: max-content': 'max-h-max',
  'max-height: fit-content': 'max-h-fit',

  // Inset
  'top: 0': 'top-0',
  'right: 0': 'right-0',
  'bottom: 0': 'bottom-0',
  'left: 0': 'left-0',
  'inset: 0': 'inset-0',
  'top: auto': 'top-auto',
  'right: auto': 'right-auto',
  'bottom: auto': 'bottom-auto',
  'left: auto': 'left-auto',
  'inset: auto': 'inset-auto',
  'top: 50%': 'top-1/2',
  'right: 50%': 'right-1/2',
  'bottom: 50%': 'bottom-1/2',
  'left: 50%': 'left-1/2',
  'top: 100%': 'top-full',
  'right: 100%': 'right-full',
  'bottom: 100%': 'bottom-full',
  'left: 100%': 'left-full',

  // Transform origin
  'transform-origin: center': 'origin-center',
  'transform-origin: top': 'origin-top',
  'transform-origin: top right': 'origin-top-right',
  'transform-origin: right': 'origin-right',
  'transform-origin: bottom right': 'origin-bottom-right',
  'transform-origin: bottom': 'origin-bottom',
  'transform-origin: bottom left': 'origin-bottom-left',
  'transform-origin: left': 'origin-left',
  'transform-origin: top left': 'origin-top-left',

  // Transition property
  'transition-property: none': 'transition-none',
  'transition-property: all': 'transition-all',
  'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter': 'transition',
  'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke': 'transition-colors',
  'transition-property: opacity': 'transition-opacity',
  'transition-property: box-shadow': 'transition-shadow',
  'transition-property: transform': 'transition-transform',

  // Content
  'content: none': 'content-none',
  'content: ""': "content-['']",
  "content: ''": "content-['']",

  // Forced color adjust
  'forced-color-adjust: auto': 'forced-color-adjust-auto',
  'forced-color-adjust: none': 'forced-color-adjust-none',

  // Color scheme
  'color-scheme: normal': 'scheme-normal',
  'color-scheme: light': 'scheme-light',
  'color-scheme: dark': 'scheme-dark',
  'color-scheme: light dark': 'scheme-light-dark',
};

/**
 * Property-specific converters for values that need dynamic conversion
 */
export const propertyConverters = {
  // Spacing properties
  'gap': (value) => convertSpacing(value, 'gap'),
  'row-gap': (value) => convertSpacing(value, 'gap-y'),
  'column-gap': (value) => convertSpacing(value, 'gap-x'),
  'padding': (value) => convertPadding(value),
  'padding-top': (value) => convertSpacing(value, 'pt'),
  'padding-right': (value) => convertSpacing(value, 'pr'),
  'padding-bottom': (value) => convertSpacing(value, 'pb'),
  'padding-left': (value) => convertSpacing(value, 'pl'),
  'padding-inline': (value) => convertSpacing(value, 'px'),
  'padding-block': (value) => convertSpacing(value, 'py'),
  'margin': (value) => convertMargin(value),
  'margin-top': (value) => convertSpacing(value, 'mt'),
  'margin-right': (value) => convertSpacing(value, 'mr'),
  'margin-bottom': (value) => convertSpacing(value, 'mb'),
  'margin-left': (value) => convertSpacing(value, 'ml'),
  'margin-inline': (value) => convertSpacing(value, 'mx'),
  'margin-block': (value) => convertSpacing(value, 'my'),

  // Sizing
  'width': (value) => convertSize(value, 'w'),
  'height': (value) => convertSize(value, 'h'),
  'min-width': (value) => convertSize(value, 'min-w'),
  'min-height': (value) => convertSize(value, 'min-h'),
  'max-width': (value) => convertMaxWidth(value),
  'max-height': (value) => convertSize(value, 'max-h'),
  'size': (value) => convertSize(value, 'size'),

  // Typography
  'font-size': (value) => convertFontSize(value),
  'font-weight': (value) => convertFontWeight(value),
  'line-height': (value) => convertLineHeight(value),
  'letter-spacing': (value) => convertLetterSpacing(value),

  // Colors
  'color': (value) => convertColor(value, 'text'),
  'background-color': (value) => convertColor(value, 'bg'),
  'border-color': (value) => convertColor(value, 'border'),
  'outline-color': (value) => convertColor(value, 'outline'),
  'fill': (value) => convertColor(value, 'fill'),
  'stroke': (value) => convertColor(value, 'stroke'),
  'text-decoration-color': (value) => convertColor(value, 'decoration'),

  // Border
  'border': (value) => convertBorder(value),
  'border-width': (value) => convertBorderWidth(value, 'border'),
  'border-top-width': (value) => convertBorderWidth(value, 'border-t'),
  'border-right-width': (value) => convertBorderWidth(value, 'border-r'),
  'border-bottom-width': (value) => convertBorderWidth(value, 'border-b'),
  'border-left-width': (value) => convertBorderWidth(value, 'border-l'),
  'border-radius': (value) => convertBorderRadius(value),
  'border-top-left-radius': (value) => convertBorderRadiusCorner(value, 'rounded-tl'),
  'border-top-right-radius': (value) => convertBorderRadiusCorner(value, 'rounded-tr'),
  'border-bottom-right-radius': (value) => convertBorderRadiusCorner(value, 'rounded-br'),
  'border-bottom-left-radius': (value) => convertBorderRadiusCorner(value, 'rounded-bl'),

  // Outline
  'outline-width': (value) => convertOutlineWidth(value),
  'outline-offset': (value) => convertOutlineOffset(value),

  // Opacity
  'opacity': (value) => convertOpacity(value),

  // Z-index
  'z-index': (value) => convertZIndex(value),

  // Transitions
  'transition': (value) => convertTransition(value),
  'transition-duration': (value) => convertDuration(value, 'duration'),
  'transition-delay': (value) => convertDuration(value, 'delay'),
  'transition-timing-function': (value) => convertEasing(value),

  // Box shadow
  'box-shadow': (value) => convertBoxShadow(value),

  // Transform
  'transform': (value) => convertTransform(value),
  'translate': (value) => convertTranslate(value),
  'rotate': (value) => convertRotate(value),
  'scale': (value) => convertScale(value),

  // Flex/Grid order
  'order': (value) => convertOrder(value),
  'flex-basis': (value) => convertFlexBasis(value),
  'grid-template-columns': (value) => convertGridCols(value),
  'grid-template-rows': (value) => convertGridRows(value),
  'grid-column': (value) => convertGridColumn(value),
  'grid-row': (value) => convertGridRow(value),
  'grid-column-start': (value) => convertGridColStart(value),
  'grid-column-end': (value) => convertGridColEnd(value),
  'grid-row-start': (value) => convertGridRowStart(value),
  'grid-row-end': (value) => convertGridRowEnd(value),

  // Inset
  'top': (value) => convertInset(value, 'top'),
  'right': (value) => convertInset(value, 'right'),
  'bottom': (value) => convertInset(value, 'bottom'),
  'left': (value) => convertInset(value, 'left'),
  'inset': (value) => convertInset(value, 'inset'),
  'inset-x': (value) => convertInset(value, 'inset-x'),
  'inset-y': (value) => convertInset(value, 'inset-y'),

  // Text
  'text-indent': (value) => convertSpacing(value, 'indent'),

  // Background
  'background': (value) => convertBackground(value),
};

// Helper functions for conversions

function convertSpacing(value, prefix) {
  value = value.trim();
  
  // Handle auto
  if (value === 'auto') {
    return `${prefix}-auto`;
  }
  
  // Handle CSS variables
  if (value.includes('var(')) {
    return `${prefix}-[${value}]`;
  }
  
  // Handle negative values
  const isNegative = value.startsWith('-');
  const absValue = isNegative ? value.slice(1) : value;
  const negPrefix = isNegative ? '-' : '';
  
  // Check scale
  if (spacingScale[absValue]) {
    return `${negPrefix}${prefix}-${spacingScale[absValue]}`;
  }
  
  // Arbitrary value
  return `${negPrefix}${prefix}-[${value}]`;
}

function convertPadding(value) {
  const parts = value.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return convertSpacing(parts[0], 'p');
  }
  
  if (parts.length === 2) {
    const [y, x] = parts;
    const classes = [];
    if (y !== '0' && y !== '0px') classes.push(convertSpacing(y, 'py'));
    if (x !== '0' && x !== '0px') classes.push(convertSpacing(x, 'px'));
    return classes.join(' ');
  }
  
  if (parts.length === 3) {
    const [top, x, bottom] = parts;
    const classes = [];
    if (top !== '0' && top !== '0px') classes.push(convertSpacing(top, 'pt'));
    if (x !== '0' && x !== '0px') classes.push(convertSpacing(x, 'px'));
    if (bottom !== '0' && bottom !== '0px') classes.push(convertSpacing(bottom, 'pb'));
    return classes.join(' ');
  }
  
  if (parts.length === 4) {
    const [top, right, bottom, left] = parts;
    const classes = [];
    if (top !== '0' && top !== '0px') classes.push(convertSpacing(top, 'pt'));
    if (right !== '0' && right !== '0px') classes.push(convertSpacing(right, 'pr'));
    if (bottom !== '0' && bottom !== '0px') classes.push(convertSpacing(bottom, 'pb'));
    if (left !== '0' && left !== '0px') classes.push(convertSpacing(left, 'pl'));
    return classes.join(' ');
  }
  
  return `p-[${value}]`;
}

function convertMargin(value) {
  const parts = value.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return convertSpacing(parts[0], 'm');
  }
  
  if (parts.length === 2) {
    const [y, x] = parts;
    const classes = [];
    if (y !== '0' && y !== '0px') classes.push(convertSpacing(y, 'my'));
    if (x !== '0' && x !== '0px') classes.push(convertSpacing(x, 'mx'));
    return classes.join(' ');
  }
  
  if (parts.length === 4) {
    const [top, right, bottom, left] = parts;
    const classes = [];
    if (top !== '0' && top !== '0px') classes.push(convertSpacing(top, 'mt'));
    if (right !== '0' && right !== '0px') classes.push(convertSpacing(right, 'mr'));
    if (bottom !== '0' && bottom !== '0px') classes.push(convertSpacing(bottom, 'mb'));
    if (left !== '0' && left !== '0px') classes.push(convertSpacing(left, 'ml'));
    return classes.join(' ');
  }
  
  return `m-[${value}]`;
}

function convertSize(value, prefix) {
  value = value.trim();
  
  // Handle common keywords
  const keywords = {
    'auto': 'auto',
    '100%': 'full',
    '100vw': 'screen',
    '100vh': 'screen',
    '100svw': 'svw',
    '100svh': 'svh',
    '100lvw': 'lvw',
    '100lvh': 'lvh',
    '100dvw': 'dvw',
    '100dvh': 'dvh',
    'min-content': 'min',
    'max-content': 'max',
    'fit-content': 'fit',
  };
  
  if (keywords[value]) {
    return `${prefix}-${keywords[value]}`;
  }
  
  // Handle fractions
  if (value.endsWith('%')) {
    const percent = parseFloat(value);
    const fractions = {
      50: '1/2',
      33.333333: '1/3',
      66.666667: '2/3',
      25: '1/4',
      75: '3/4',
      20: '1/5',
      40: '2/5',
      60: '3/5',
      80: '4/5',
      16.666667: '1/6',
      83.333333: '5/6',
    };
    if (fractions[percent]) {
      return `${prefix}-${fractions[percent]}`;
    }
  }
  
  // Handle CSS variables
  if (value.includes('var(')) {
    return `${prefix}-[${value}]`;
  }
  
  // Check spacing scale
  if (spacingScale[value]) {
    return `${prefix}-${spacingScale[value]}`;
  }
  
  // Arbitrary value
  return `${prefix}-[${value}]`;
}

function convertMaxWidth(value) {
  value = value.trim();
  
  const maxWidthScale = {
    'none': 'none',
    '0': '0',
    '20rem': 'xs',
    '24rem': 'sm',
    '28rem': 'md',
    '32rem': 'lg',
    '36rem': 'xl',
    '42rem': '2xl',
    '48rem': '3xl',
    '56rem': '4xl',
    '64rem': '5xl',
    '72rem': '6xl',
    '80rem': '7xl',
    '100%': 'full',
    'min-content': 'min',
    'max-content': 'max',
    'fit-content': 'fit',
    '65ch': 'prose',
  };
  
  if (maxWidthScale[value]) {
    return `max-w-${maxWidthScale[value]}`;
  }
  
  if (value.includes('var(')) {
    return `max-w-[${value}]`;
  }
  
  return `max-w-[${value}]`;
}

function convertFontSize(value) {
  value = value.trim();
  
  if (fontSizeScale[value]) {
    return `text-${fontSizeScale[value]}`;
  }
  
  if (value.includes('var(')) {
    return `text-[${value}]`;
  }
  
  return `text-[${value}]`;
}

function convertFontWeight(value) {
  value = value.trim();
  
  if (fontWeightScale[value]) {
    return `font-${fontWeightScale[value]}`;
  }
  
  return `font-[${value}]`;
}

function convertLineHeight(value) {
  value = value.trim();
  
  if (lineHeightScale[value]) {
    return `leading-${lineHeightScale[value]}`;
  }
  
  return `leading-[${value}]`;
}

function convertLetterSpacing(value) {
  value = value.trim();
  
  const scale = {
    '-0.05em': 'tighter',
    '-0.025em': 'tight',
    '0': 'normal',
    '0em': 'normal',
    '0.025em': 'wide',
    '0.05em': 'wider',
    '0.1em': 'widest',
  };
  
  if (scale[value]) {
    return `tracking-${scale[value]}`;
  }
  
  return `tracking-[${value}]`;
}

function convertColor(value, prefix) {
  value = value.trim();
  
  // Handle CSS variables
  if (value.includes('var(')) {
    return `${prefix}-[${value}]`;
  }
  
  // Handle named colors
  if (namedColors[value]) {
    return `${prefix}-${namedColors[value]}`;
  }
  
  // Handle hex colors
  if (value.startsWith('#')) {
    return `${prefix}-[${value}]`;
  }
  
  // Handle rgb/rgba/hsl/hsla/oklch - normalize by removing spaces after commas
  if (value.match(/^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/)) {
    // Normalize: rgba(255, 255, 255, 0.15) -> rgba(255,255,255,0.15)
    const normalized = value.replace(/,\s+/g, ',').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
    return `${prefix}-[${normalized}]`;
  }
  
  return `${prefix}-[${value}]`;
}

function convertBorder(value) {
  value = value.trim();
  
  // Handle CSS variables
  if (value.includes('var(')) {
    // Try to parse common patterns
    const match = value.match(/^(\d+px)\s+(solid|dashed|dotted)\s+(.+)$/);
    if (match) {
      const [, width, style, color] = match;
      const classes = [];
      classes.push(convertBorderWidth(width, 'border'));
      classes.push(`border-${style}`);
      classes.push(convertColor(color, 'border'));
      return classes.join(' ');
    }
    return `border-[${value}]`;
  }
  
  // Parse border shorthand: width style color
  const match = value.match(/^(\d+px)\s+(solid|dashed|dotted|double|none)\s+(.+)$/);
  if (match) {
    const [, width, style, color] = match;
    const classes = [];
    classes.push(convertBorderWidth(width, 'border'));
    if (style !== 'solid') classes.push(`border-${style}`);
    classes.push(convertColor(color, 'border'));
    return classes.join(' ');
  }
  
  // Just width
  if (value.match(/^\d+px$/)) {
    return convertBorderWidth(value, 'border');
  }
  
  return `border-[${value}]`;
}

function convertBorderWidth(value, prefix) {
  value = value.trim();
  
  const scale = {
    '0': '0',
    '0px': '0',
    '1px': '',
    '2px': '2',
    '4px': '4',
    '8px': '8',
  };
  
  if (scale[value] !== undefined) {
    return scale[value] === '' ? prefix : `${prefix}-${scale[value]}`;
  }
  
  return `${prefix}-[${value}]`;
}

function convertBorderRadius(value) {
  value = value.trim();
  
  if (borderRadiusScale[value]) {
    const size = borderRadiusScale[value];
    return size === 'DEFAULT' ? 'rounded' : `rounded-${size}`;
  }
  
  if (value.includes('var(')) {
    return `rounded-[${value}]`;
  }
  
  return `rounded-[${value}]`;
}

function convertBorderRadiusCorner(value, prefix) {
  value = value.trim();
  
  if (borderRadiusScale[value]) {
    const size = borderRadiusScale[value];
    return size === 'DEFAULT' ? prefix : `${prefix}-${size}`;
  }
  
  return `${prefix}-[${value}]`;
}

function convertOutlineWidth(value) {
  value = value.trim();
  
  const scale = {
    '0': '0',
    '0px': '0',
    '1px': '1',
    '2px': '2',
    '4px': '4',
    '8px': '8',
  };
  
  if (scale[value]) {
    return `outline-${scale[value]}`;
  }
  
  return `outline-[${value}]`;
}

function convertOutlineOffset(value) {
  value = value.trim();
  
  const scale = {
    '0': '0',
    '0px': '0',
    '1px': '1',
    '2px': '2',
    '4px': '4',
    '8px': '8',
  };
  
  if (scale[value]) {
    return `outline-offset-${scale[value]}`;
  }
  
  return `outline-offset-[${value}]`;
}

function convertOpacity(value) {
  value = value.trim();
  
  if (opacityScale[value]) {
    return `opacity-${opacityScale[value]}`;
  }
  
  // Convert decimal to percentage
  const num = parseFloat(value);
  if (!isNaN(num) && num >= 0 && num <= 1) {
    const percent = Math.round(num * 100);
    return `opacity-${percent}`;
  }
  
  return `opacity-[${value}]`;
}

function convertZIndex(value) {
  value = value.trim();
  
  if (zIndexScale[value]) {
    return `z-${zIndexScale[value]}`;
  }
  
  // Handle negative values
  if (value.startsWith('-')) {
    return `-z-[${value.slice(1)}]`;
  }
  
  return `z-[${value}]`;
}

function convertTransition(value) {
  value = value.trim();
  
  // Handle 'all Xms ease' pattern
  const match = value.match(/^all\s+(\d+m?s)\s+(ease|ease-in|ease-out|ease-in-out|linear)$/);
  if (match) {
    const [, duration, easing] = match;
    return `transition-all ${convertDuration(duration, 'duration')} ${convertEasing(easing)}`;
  }
  
  // Handle 'none'
  if (value === 'none') {
    return 'transition-none';
  }
  
  // Complex transitions - use arbitrary value
  return `transition-[${value.replace(/\s+/g, '_')}]`;
}

function convertDuration(value, prefix) {
  value = value.trim();
  
  // Convert seconds to milliseconds
  if (value.endsWith('s') && !value.endsWith('ms')) {
    value = (parseFloat(value) * 1000) + 'ms';
  }
  
  if (durationScale[value]) {
    return `${prefix}-${durationScale[value]}`;
  }
  
  // Extract number from ms
  const ms = parseInt(value);
  if (!isNaN(ms)) {
    return `${prefix}-${ms}`;
  }
  
  return `${prefix}-[${value}]`;
}

function convertEasing(value) {
  value = value.trim();
  
  // Check if it's in the scale
  if (value in easingScale) {
    const mapped = easingScale[value];
    // null means skip (ease is the default)
    if (mapped === null) return '';
    return `ease-${mapped}`;
  }
  
  // Handle cubic-bezier
  if (value.startsWith('cubic-bezier')) {
    return `ease-[${value.replace(/\s/g, '')}]`;
  }
  
  return `ease-[${value}]`;
}

function convertBoxShadow(value) {
  value = value.trim();
  
  if (value === 'none') {
    return 'shadow-none';
  }
  
  // Common shadow patterns
  const shadowScale = {
    '0 1px 2px 0 rgb(0 0 0 / 0.05)': 'shadow-sm',
    '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)': 'shadow',
    '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)': 'shadow-md',
    '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)': 'shadow-lg',
    '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)': 'shadow-xl',
    '0 25px 50px -12px rgb(0 0 0 / 0.25)': 'shadow-2xl',
    'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)': 'shadow-inner',
  };
  
  if (shadowScale[value]) {
    return shadowScale[value];
  }
  
  // Handle CSS variables
  if (value.includes('var(')) {
    return `shadow-[${value}]`;
  }
  
  return `shadow-[${value.replace(/\s+/g, '_')}]`;
}

function convertTransform(value) {
  value = value.trim();
  
  if (value === 'none') {
    return 'transform-none';
  }
  
  // Parse individual transform functions
  const classes = [];
  const transforms = value.match(/(\w+)\(([^)]+)\)/g) || [];
  
  for (const transform of transforms) {
    const match = transform.match(/(\w+)\(([^)]+)\)/);
    if (!match) continue;
    
    const [, func, args] = match;
    
    switch (func) {
      case 'translateX':
        classes.push(convertSpacing(args, 'translate-x'));
        break;
      case 'translateY':
        classes.push(convertSpacing(args, 'translate-y'));
        break;
      case 'rotate':
        classes.push(convertRotate(args));
        break;
      case 'scaleX':
        classes.push(`scale-x-[${args}]`);
        break;
      case 'scaleY':
        classes.push(`scale-y-[${args}]`);
        break;
      case 'scale':
        classes.push(convertScale(args));
        break;
      case 'skewX':
        classes.push(`skew-x-[${args}]`);
        break;
      case 'skewY':
        classes.push(`skew-y-[${args}]`);
        break;
      default:
        // Unknown transform, keep as arbitrary
        classes.push(`[transform:${transform}]`);
    }
  }
  
  return classes.join(' ') || `[transform:${value}]`;
}

function convertTranslate(value) {
  const parts = value.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return convertSpacing(parts[0], 'translate');
  }
  
  if (parts.length === 2) {
    const [x, y] = parts;
    return `${convertSpacing(x, 'translate-x')} ${convertSpacing(y, 'translate-y')}`;
  }
  
  return `translate-[${value}]`;
}

function convertRotate(value) {
  value = value.trim();
  
  const scale = {
    '0': '0',
    '0deg': '0',
    '1deg': '1',
    '2deg': '2',
    '3deg': '3',
    '6deg': '6',
    '12deg': '12',
    '45deg': '45',
    '90deg': '90',
    '180deg': '180',
  };
  
  // Handle negative values
  const isNegative = value.startsWith('-');
  const absValue = isNegative ? value.slice(1) : value;
  const negPrefix = isNegative ? '-' : '';
  
  if (scale[absValue]) {
    return `${negPrefix}rotate-${scale[absValue]}`;
  }
  
  return `${negPrefix}rotate-[${value}]`;
}

function convertScale(value) {
  value = value.trim();
  
  const scale = {
    '0': '0',
    '.5': '50',
    '0.5': '50',
    '.75': '75',
    '0.75': '75',
    '.9': '90',
    '0.9': '90',
    '.95': '95',
    '0.95': '95',
    '1': '100',
    '1.05': '105',
    '1.1': '110',
    '1.25': '125',
    '1.5': '150',
  };
  
  if (scale[value]) {
    return `scale-${scale[value]}`;
  }
  
  // Convert decimal to percentage
  const num = parseFloat(value);
  if (!isNaN(num)) {
    return `scale-[${value}]`;
  }
  
  return `scale-[${value}]`;
}

function convertOrder(value) {
  value = value.trim();
  
  const scale = {
    '-9999': 'first',
    '9999': 'last',
    '0': 'none',
    '1': '1',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    '11': '11',
    '12': '12',
  };
  
  if (scale[value]) {
    return `order-${scale[value]}`;
  }
  
  return `order-[${value}]`;
}

function convertFlexBasis(value) {
  value = value.trim();
  
  if (value === 'auto') {
    return 'basis-auto';
  }
  
  if (value === '100%') {
    return 'basis-full';
  }
  
  if (spacingScale[value]) {
    return `basis-${spacingScale[value]}`;
  }
  
  // Handle fractions
  if (value.endsWith('%')) {
    const fractions = {
      '50%': '1/2',
      '33.333333%': '1/3',
      '66.666667%': '2/3',
      '25%': '1/4',
      '75%': '3/4',
      '20%': '1/5',
      '40%': '2/5',
      '60%': '3/5',
      '80%': '4/5',
    };
    if (fractions[value]) {
      return `basis-${fractions[value]}`;
    }
  }
  
  return `basis-[${value}]`;
}

function convertGridCols(value) {
  value = value.trim();
  
  if (value === 'none') {
    return 'grid-cols-none';
  }
  
  // Handle repeat(N, 1fr) or repeat(N, minmax(0, 1fr))
  const repeatMatch = value.match(/^repeat\((\d+),\s*(?:1fr|minmax\(0,\s*1fr\))\)$/);
  if (repeatMatch) {
    return `grid-cols-${repeatMatch[1]}`;
  }
  
  // Handle subgrid
  if (value === 'subgrid') {
    return 'grid-cols-subgrid';
  }
  
  return `grid-cols-[${value.replace(/\s+/g, '_')}]`;
}

function convertGridRows(value) {
  value = value.trim();
  
  if (value === 'none') {
    return 'grid-rows-none';
  }
  
  const repeatMatch = value.match(/^repeat\((\d+),\s*(?:1fr|minmax\(0,\s*1fr\))\)$/);
  if (repeatMatch) {
    return `grid-rows-${repeatMatch[1]}`;
  }
  
  if (value === 'subgrid') {
    return 'grid-rows-subgrid';
  }
  
  return `grid-rows-[${value.replace(/\s+/g, '_')}]`;
}

function convertGridColumn(value) {
  value = value.trim();
  
  if (value === 'auto') {
    return 'col-auto';
  }
  
  // Handle span N
  const spanMatch = value.match(/^span\s+(\d+)\s*\/\s*span\s+\d+$/);
  if (spanMatch) {
    return `col-span-${spanMatch[1]}`;
  }
  
  const simpleSpan = value.match(/^span\s+(\d+)$/);
  if (simpleSpan) {
    return `col-span-${simpleSpan[1]}`;
  }
  
  if (value === '1 / -1') {
    return 'col-span-full';
  }
  
  return `col-[${value.replace(/\s+/g, '_')}]`;
}

function convertGridRow(value) {
  value = value.trim();
  
  if (value === 'auto') {
    return 'row-auto';
  }
  
  const spanMatch = value.match(/^span\s+(\d+)$/);
  if (spanMatch) {
    return `row-span-${spanMatch[1]}`;
  }
  
  if (value === '1 / -1') {
    return 'row-span-full';
  }
  
  return `row-[${value.replace(/\s+/g, '_')}]`;
}

function convertGridColStart(value) {
  value = value.trim();
  
  if (value === 'auto') {
    return 'col-start-auto';
  }
  
  const num = parseInt(value);
  if (!isNaN(num) && num >= 1 && num <= 13) {
    return `col-start-${num}`;
  }
  
  return `col-start-[${value}]`;
}

function convertGridColEnd(value) {
  value = value.trim();
  
  if (value === 'auto') {
    return 'col-end-auto';
  }
  
  const num = parseInt(value);
  if (!isNaN(num) && num >= 1 && num <= 13) {
    return `col-end-${num}`;
  }
  
  return `col-end-[${value}]`;
}

function convertGridRowStart(value) {
  value = value.trim();
  
  if (value === 'auto') {
    return 'row-start-auto';
  }
  
  const num = parseInt(value);
  if (!isNaN(num) && num >= 1 && num <= 7) {
    return `row-start-${num}`;
  }
  
  return `row-start-[${value}]`;
}

function convertGridRowEnd(value) {
  value = value.trim();
  
  if (value === 'auto') {
    return 'row-end-auto';
  }
  
  const num = parseInt(value);
  if (!isNaN(num) && num >= 1 && num <= 7) {
    return `row-end-${num}`;
  }
  
  return `row-end-[${value}]`;
}

function convertInset(value, prefix) {
  value = value.trim();
  
  if (value === 'auto') {
    return `${prefix}-auto`;
  }
  
  if (value === '0' || value === '0px') {
    return `${prefix}-0`;
  }
  
  if (value === '50%') {
    return `${prefix}-1/2`;
  }
  
  if (value === '100%') {
    return `${prefix}-full`;
  }
  
  // Handle CSS variables
  if (value.includes('var(')) {
    return `${prefix}-[${value}]`;
  }
  
  // Handle negative values
  const isNegative = value.startsWith('-');
  const absValue = isNegative ? value.slice(1) : value;
  const negPrefix = isNegative ? '-' : '';
  
  if (spacingScale[absValue]) {
    return `${negPrefix}${prefix}-${spacingScale[absValue]}`;
  }
  
  return `${negPrefix}${prefix}-[${value}]`;
}

function convertBackground(value) {
  value = value.trim();
  
  // Handle CSS variables
  if (value.includes('var(')) {
    return `bg-[${value}]`;
  }
  
  // Handle named colors
  if (namedColors[value]) {
    return `bg-${namedColors[value]}`;
  }
  
  // Handle gradients
  if (value.includes('gradient')) {
    return `bg-[${value.replace(/\s+/g, '_')}]`;
  }
  
  return `bg-[${value}]`;
}

// Export scales for use in other modules
export { spacingScale, fontSizeScale, fontWeightScale, borderRadiusScale, lineHeightScale, opacityScale, durationScale, easingScale, namedColors };

