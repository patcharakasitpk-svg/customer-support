const { openDb, DEFAULT_DB_PATH } = require('./db');
const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const db = openDb(process.env.DB_PATH || DEFAULT_DB_PATH);

createApp({ db }).listen(port, () => {
  console.log(`Customer Support running at http://localhost:${port}`);
});
