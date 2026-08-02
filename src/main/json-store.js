// Helper de persistencia JSON bajo userData.
// Lectura tolerante a archivo ausente o JSON corrupto: nunca lanza, siempre
// devuelve el `fallback` en esos casos (D11/ADR-0006).
'use strict'

const fs = require('fs')

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    return fallback
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

module.exports = { readJson, writeJson }
