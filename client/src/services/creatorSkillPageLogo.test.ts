import { expect, it } from 'vitest';
import { pageLinksProposedLogo } from './creatorSkillPageLogo';

it('accepts an explicitly embedded logo on a company page', () => {
  expect(pageLinksProposedLogo('<img alt="Pepsi logo" src="https://cdn.example/pepsi.png">', 'https://pepsi.example/about', 'https://cdn.example/pepsi.png')).toBe(true);
  expect(pageLinksProposedLogo('<meta property="og:image" content="https://cdn.example/social.png">', 'https://pepsi.example/about', 'https://cdn.example/social.png')).toBe(true);
});

it('rejects image URLs mentioned only in scripts, text, or unrelated images', () => {
  const url = 'https://cdn.example/pepsi.png';
  expect(pageLinksProposedLogo(`<script>const logo = '${url}'</script>`, 'https://pepsi.example/about', url)).toBe(false);
  expect(pageLinksProposedLogo(`<script>const markup = '<img alt="Pepsi logo" src="${url}">'</script>`, 'https://pepsi.example/about', url)).toBe(false);
  expect(pageLinksProposedLogo(`<!-- <img alt="Pepsi logo" src="${url}"> -->`, 'https://pepsi.example/about', url)).toBe(false);
  expect(pageLinksProposedLogo(`<p>${url}</p><img alt="product" src="${url}">`, 'https://pepsi.example/about', url)).toBe(false);
  expect(pageLinksProposedLogo('<img alt="Pepsi logo" src="http://cdn.example/pepsi.png">', 'https://pepsi.example/about', 'http://cdn.example/pepsi.png')).toBe(false);
});
