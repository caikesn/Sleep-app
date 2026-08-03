import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTotal, ordinal } from './format';

test('ordinal takes the suffix off the last digit', () => {
  assert.equal(ordinal(1), '1st');
  assert.equal(ordinal(2), '2nd');
  assert.equal(ordinal(3), '3rd');
  assert.equal(ordinal(4), '4th');
  assert.equal(ordinal(9), '9th');
});

test('the teens are all th, whatever they end in', () => {
  // The whole reason this is a function. A streak of eleven nights reading
  // "11st night" is two nights in every ten looking broken.
  assert.equal(ordinal(11), '11th');
  assert.equal(ordinal(12), '12th');
  assert.equal(ordinal(13), '13th');
  assert.equal(ordinal(14), '14th');
});

test('past twenty the last digit rules again', () => {
  assert.equal(ordinal(21), '21st');
  assert.equal(ordinal(22), '22nd');
  assert.equal(ordinal(23), '23rd');
  assert.equal(ordinal(30), '30th');
  assert.equal(ordinal(101), '101st');
});

test('and the hundred-and-teens go back to th', () => {
  // The case a last-two-digits check gets wrong: 111 does not end in "11".
  assert.equal(ordinal(111), '111th');
  assert.equal(ordinal(112), '112th');
  assert.equal(ordinal(113), '113th');
});

test('zero is a th, so an empty streak never reads as 0st', () => {
  assert.equal(ordinal(0), '0th');
});

test('formatTotal says minutes the way a person would', () => {
  assert.equal(formatTotal(45), '45m');
  assert.equal(formatTotal(60), '1h');
  assert.equal(formatTotal(84), '1h 24m');
  assert.equal(formatTotal(0), '0m');
});
