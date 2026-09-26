const test = require('node:test');
const assert = require('node:assert/strict');
const { requireLogin, requireRole, redirectIfLoggedIn } = require('../../src/middleware/auth');

const customer = { id: 1, role: 'customer' };
const agent = { id: 2, role: 'agent' };

// Records what a middleware did to the response instead of sending anything.
function fakeRes() {
  return {
    statusCode: 200,
    redirectedTo: null,
    rendered: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    redirect(url) {
      this.redirectedTo = url;
      return this;
    },
    render(view, locals) {
      this.rendered = { view, locals };
      return this;
    },
  };
}

function run(middleware, user) {
  const res = fakeRes();
  let nextCalled = false;
  middleware({ user }, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

test('requireLogin sends anonymous visitors to /login', () => {
  const { res, nextCalled } = run(requireLogin, null);
  assert.equal(res.redirectedTo, '/login');
  assert.equal(nextCalled, false);
});

test('requireLogin lets logged-in users through', () => {
  const { res, nextCalled } = run(requireLogin, customer);
  assert.equal(nextCalled, true);
  assert.equal(res.redirectedTo, null);
});

test('requireRole lets the matching role through', () => {
  assert.equal(run(requireRole('agent'), agent).nextCalled, true);
  assert.equal(run(requireRole('customer'), customer).nextCalled, true);
});

test('requireRole answers 403 with the error page for any other role', () => {
  const { res, nextCalled } = run(requireRole('agent'), customer);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.rendered.view, 'error');
  assert.equal(res.rendered.locals.title, 'ไม่มีสิทธิ์เข้าถึง');
});

test('redirectIfLoggedIn sends logged-in users to /tickets', () => {
  const { res, nextCalled } = run(redirectIfLoggedIn, agent);
  assert.equal(res.redirectedTo, '/tickets');
  assert.equal(nextCalled, false);
});

test('redirectIfLoggedIn lets anonymous visitors through', () => {
  assert.equal(run(redirectIfLoggedIn, null).nextCalled, true);
});
