const test = require('node:test');
const assert = require('node:assert/strict');
const { text } = require('../../src/forms');

test('text returns strings unchanged, including empty and whitespace', () => {
  assert.equal(text('hello'), 'hello');
  assert.equal(text(''), '');
  assert.equal(text('  spaced  '), '  spaced  ');
});

test('text turns anything that is not a string into an empty string', () => {
  for (const value of [undefined, null, 42, ['a', 'b'], { a: 1 }, true]) {
    assert.equal(text(value), '', String(value));
  }
});
