// utils/stateManager.js
const fs = require('fs')
const path = require('path')

// Define la ruta del archivo (por ejemplo, en la carpeta de usuario o la raíz del proyecto)
const stateFilePath = path.join(__dirname, 'state.txt')

function guardarEstado(mostrarMenu) {
  // Guarda "true" o "false" según el estado
  fs.writeFileSync(stateFilePath, mostrarMenu ? 'true' : 'false', 'utf-8')
}

function leerEstado() {
  if (fs.existsSync(stateFilePath)) {
    const data = fs.readFileSync(stateFilePath, 'utf-8')
    // Retorna un booleano
    return data.trim() === 'true'
  }
  // Si no existe el archivo, puedes definir un valor por defecto (por ejemplo, true para mostrar el menú)
  return true
}

module.exports = {
  guardarEstado,
  leerEstado
}
