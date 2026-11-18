import { describe, expect, it } from 'vitest';
import {
  defaultContent,
  renderBody,
  renderEmail,
  validButtonUrl,
} from '../../../../packages/email-composer/src/template';

describe('shared email template', () => {
  it('escapes custom text and preserves line breaks without inserting markup', () => {
    const html = renderBody({
      ...defaultContent,
      heading: '<script>alert(1)</script>',
      message: 'First\nSecond & third',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('First<br>Second &amp; third');
  });
  it('only accepts http(s) action destinations', () => {
    expect(validButtonUrl('javascript:alert(1)')).toBe(false);
    expect(validButtonUrl('data:text/html,test')).toBe(false);
    expect(validButtonUrl('https://clippster.app/download?os=windows')).toBe(true);
  });
  it('omits optional actions and retains the shared footer', () => {
    const body = renderBody({ ...defaultContent, includeButton: false });
    expect(body).not.toContain('data-email-field="button"');
    const html = renderEmail(body, 'Preview', 'waitlist');
    expect(html).toContain('OpenWorth Technologies Inc');
    expect(html).toContain('https://discord.gg/4kTCvKEVuV');
    expect(html).toContain('mailto:support@clippster.app');
    expect(html).not.toContain('412 W');
  });
  it('replaces layout slots once and uses the selected audience', () => {
    const html = renderEmail('<p>__REASON__</p>', '<b>preview</b>', 'individual');
    expect(html).toContain('<p>__REASON__</p>');
    expect(html).toContain('&lt;b&gt;preview&lt;/b&gt;');
    expect(html).toContain('sent it to you directly');
  });
  it('uses the branded masthead and shared campaign styles in the preview', () => {
    const html = renderEmail(renderBody(defaultContent), 'Inbox-only preview', 'waitlist');
    expect(html).toContain('<img src="data:image/png;base64,');
    expect(html).toContain('alt="Clippster"');
    expect(html).toContain('<div hidden style="display:none');
    expect(html).toContain('class="email-heading" data-email-field="heading"');
    expect(html).toContain('background-color:#5cd7fc');
  });
});
