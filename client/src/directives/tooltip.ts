import type { Directive, DirectiveBinding } from 'vue';

interface TooltipElement extends HTMLElement {
  _tooltipData?: {
    text: string;
    showHandler: (e: MouseEvent) => void;
    hideHandler: () => void;
  };
}

let tooltipEl: HTMLElement | null = null;
let currentTarget: TooltipElement | null = null;

const TOOLTIP_OFFSET = 8;

function createTooltip(): HTMLElement {
  if (tooltipEl) return tooltipEl;

  tooltipEl = document.createElement('div');
  tooltipEl.id = 'v-tooltip-element';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.style.cssText = `
    position: fixed;
    z-index: 99999;
    pointer-events: none;
    padding: 6px 12px;
    font-size: 12px;
    line-height: 1.4;
    font-weight: 500;
    border-radius: 6px;
    background-color: oklch(0.18 0 0);
    color: oklch(0.95 0 0);
    border: 1px solid oklch(0.28 0 0);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    max-width: 280px;
    word-wrap: break-word;
    white-space: pre-wrap;
    font-family: inherit;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.1s ease-out, transform 0.1s ease-out;
    transform: translateY(4px);
  `;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function positionTooltip(targetRect: DOMRect) {
  if (!tooltipEl) return;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const tooltipRect = tooltipEl.getBoundingClientRect();

  // Default: position below and centered on the element
  let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
  let top = targetRect.bottom + TOOLTIP_OFFSET;

  // Check if tooltip goes off bottom
  if (top + tooltipRect.height > viewportHeight - 10) {
    // Position above the element
    top = targetRect.top - tooltipRect.height - TOOLTIP_OFFSET;
  }

  // Check horizontal bounds
  if (left < 10) {
    left = 10;
  } else if (left + tooltipRect.width > viewportWidth - 10) {
    left = viewportWidth - tooltipRect.width - 10;
  }

  // If still off top, position below
  if (top < 10) {
    top = targetRect.bottom + TOOLTIP_OFFSET;
  }

  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
}

function showTooltip(el: TooltipElement) {
  const data = el._tooltipData;
  if (!data || !data.text) return;

  currentTarget = el;
  const tooltip = createTooltip();
  tooltip.textContent = data.text;

  // Make visible but transparent to measure
  tooltip.style.visibility = 'visible';
  tooltip.style.opacity = '0';

  // Position after render
  requestAnimationFrame(() => {
    const rect = el.getBoundingClientRect();
    positionTooltip(rect);

    // Animate in
    requestAnimationFrame(() => {
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
    });
  });
}

function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.style.opacity = '0';
    tooltipEl.style.transform = 'translateY(4px)';
    tooltipEl.style.visibility = 'hidden';
  }
  currentTarget = null;
}

function setupElement(el: TooltipElement, text: string) {
  // Remove native title to prevent browser tooltip
  if (el.hasAttribute('title')) {
    el.removeAttribute('title');
  }

  if (!text) {
    // If no text and already has handlers, clean up
    if (el._tooltipData) {
      el.removeEventListener('mouseenter', el._tooltipData.showHandler);
      el.removeEventListener('mouseleave', el._tooltipData.hideHandler);
      delete el._tooltipData;
    }
    return;
  }

  const showHandler = () => showTooltip(el);
  const hideHandler = () => {
    if (currentTarget === el) {
      hideTooltip();
    }
  };

  // Clean up old handlers if they exist
  if (el._tooltipData) {
    el.removeEventListener('mouseenter', el._tooltipData.showHandler);
    el.removeEventListener('mouseleave', el._tooltipData.hideHandler);
  }

  el._tooltipData = {
    text,
    showHandler,
    hideHandler,
  };

  el.addEventListener('mouseenter', showHandler);
  el.addEventListener('mouseleave', hideHandler);
}

export const vTooltip: Directive<TooltipElement, string> = {
  mounted(el: TooltipElement, binding: DirectiveBinding<string>) {
    const text = binding.value || el.getAttribute('title') || '';
    setupElement(el, text);
  },

  updated(el: TooltipElement, binding: DirectiveBinding<string>) {
    const text = binding.value || el.getAttribute('title') || '';

    // Remove native title
    if (el.hasAttribute('title')) {
      el.removeAttribute('title');
    }

    if (el._tooltipData) {
      el._tooltipData.text = text;
    } else if (text) {
      setupElement(el, text);
    }
  },

  beforeUnmount(el: TooltipElement) {
    if (el._tooltipData) {
      el.removeEventListener('mouseenter', el._tooltipData.showHandler);
      el.removeEventListener('mouseleave', el._tooltipData.hideHandler);
      delete el._tooltipData;
    }
    if (currentTarget === el) {
      hideTooltip();
    }
  },
};

// Global tooltip system that intercepts all title attributes
export function setupGlobalTooltips() {
  function processElement(el: TooltipElement) {
    const title = el.getAttribute('title');
    if (!title) return;
    if (el._tooltipData) return; // Already processed

    setupElement(el, title);
  }

  // Process all existing elements with title attributes
  document.querySelectorAll<HTMLElement>('[title]').forEach((el) => {
    processElement(el as TooltipElement);
  });

  // Watch for new elements and attribute changes
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Handle attribute changes
      if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
        const el = mutation.target as TooltipElement;
        const title = el.getAttribute('title');

        if (title) {
          if (el._tooltipData) {
            // Update existing tooltip text
            el._tooltipData.text = title;
          } else {
            // New title attribute added
            setupElement(el, title);
          }
          // Always remove native title after processing
          el.removeAttribute('title');
        }
      }

      // Handle newly added nodes
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Process the element itself
            if (node.hasAttribute('title')) {
              processElement(node as TooltipElement);
            }
            // Process all descendants with title attributes
            node.querySelectorAll<HTMLElement>('[title]').forEach((child) => {
              processElement(child as TooltipElement);
            });
          }
        });
      }
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['title'],
    childList: true,
    subtree: true,
  });

  return observer;
}

export default vTooltip;
