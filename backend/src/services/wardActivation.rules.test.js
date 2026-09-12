const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { canResidentSeeNagarsevak } = require('./wardActivation.rules');

const base = {
  residentWardId: 'ward-3',
  wardId: 'ward-3',
  wardStatus: 'ACTIVE',
  nagarsevakWardId: 'ward-3',
  nagarsevakStatus: 'ACTIVE',
  subscriptionStatus: 'ACTIVE',
};

describe('canResidentSeeNagarsevak', () => {
  it('TEST 1: inactive ward hides an active Nagarsevak', () => {
    assert.equal(canResidentSeeNagarsevak({ ...base, wardStatus: 'INACTIVE' }), false);
  });
  it('TEST 2: active ward with unpurchased Nagarsevak is hidden', () => {
    assert.equal(canResidentSeeNagarsevak({ ...base, subscriptionStatus: 'PENDING' }), false);
    assert.equal(canResidentSeeNagarsevak({ ...base, subscriptionStatus: null }), false);
  });
  it('TEST 3: active ward + purchased + active is visible', () => {
    assert.equal(canResidentSeeNagarsevak(base), true);
  });
  it('TEST 4: only the purchased Nagarsevak is visible', () => {
    assert.equal(canResidentSeeNagarsevak({ ...base, subscriptionStatus: 'ACTIVE' }), true);
    assert.equal(canResidentSeeNagarsevak({ ...base, subscriptionStatus: 'INACTIVE' }), false);
    assert.equal(canResidentSeeNagarsevak({ ...base, subscriptionStatus: 'DEACTIVATED' }), false);
  });
  it('TEST 8: deactivated Nagarsevak account is hidden', () => {
    assert.equal(canResidentSeeNagarsevak({ ...base, nagarsevakStatus: 'INACTIVE' }), false);
  });
  it('TEST 10: another wardId is rejected', () => {
    assert.equal(canResidentSeeNagarsevak({ ...base, residentWardId: 'ward-5' }), false);
    assert.equal(canResidentSeeNagarsevak({ ...base, nagarsevakWardId: 'ward-5' }), false);
  });
});
