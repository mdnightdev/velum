import { loadDb, saveDb, db } from '../server/db.js';
loadDb();
db.payment_methods = [];
db.external_financial_accounts = [];
saveDb();
console.log("Cleared payment methods and external accounts.");
