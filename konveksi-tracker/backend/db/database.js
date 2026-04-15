const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const path = require('path')

const file = path.join(__dirname, 'db.json')
const adapter = new FileSync(file)
const db = low(adapter)

// default structure
db.defaults({
  users: [],
  orders: [],
  production_logs: []
}).write()

console.log("✅ JSON DB ready")

module.exports = db