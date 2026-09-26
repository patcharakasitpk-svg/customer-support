const request = require('supertest');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');
const users = require('../src/models/users');

const PASSWORD = 'password123';
let counter = 0;

function setup() {
  const db = openDb(':memory:');
  return { db, app: createApp({ db, sessionSecret: 'test-secret' }) };
}

function makeUser(db, overrides = {}) {
  counter += 1;
  return users.createUser(db, {
    name: `User ${counter}`,
    email: `user${counter}@example.com`,
    password: PASSWORD,
    ...overrides,
  });
}

async function loginAs(app, email, password = PASSWORD) {
  const agent = request.agent(app);
  await agent.post('/login').type('form').send({ email, password }).expect(302);
  return agent;
}

module.exports = { PASSWORD, setup, makeUser, loginAs };
