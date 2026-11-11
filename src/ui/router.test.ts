import { parseRoute } from './router';

describe('parseRoute', () => {
  it.each([
    ['', { name: 'projects' }],
    ['#/projects', { name: 'projects' }],
    ['#/project/p1', { name: 'project', id: 'p1' }],
    ['#/ask/p1', { name: 'ask', id: 'p1' }],
    ['#/inventory', { name: 'inventory' }],
    ['#/settings', { name: 'settings' }],
    ['#/technique/bsl', { name: 'technique', id: 'bsl' }],
    ['#/technique/nope', { name: 'projects' }],
    ['#/whatever', { name: 'projects' }],
  ])('parses %s', (hash, expected) => {
    expect(parseRoute(hash)).toEqual(expected);
  });
});
