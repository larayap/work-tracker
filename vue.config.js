
module.exports = {
  pages: {
    index: {
      entry: 'src/main.js',
      template: 'public/index.html',
      filename: 'index.html'
    },
    history: {
      entry: 'src/history/main.js',
      template: 'public/history.html',
      filename: 'history.html'
    }
  },
  transpileDependencies: true,
  configureWebpack: {
    externals: {
      electron: 'require("electron")'
    },
    resolve: {
      fallback: {
        fs: false
      }
    },
  },
  pluginOptions: {
    electronBuilder: {
      removeBuildField: true, // Esto elimina el campo "build" del package.json final
      builderOptions: {
        appId: 'com.tuapp.cronometroapps',
        productName: 'Cronómetro Apps',
        win: {
          target: 'nsis',
          // icon: 'build/icons/icon.ico'
        },
        mac: {
          target: 'dmg',
          // icon: 'build/icons/icon.icns'
        },
        linux: {
          target: 'AppImage',
          // icon: 'build/icons'
        },
        nsis: {
          oneClick: false,
          perMachine: false,
          allowElevation: true,
          allowToChangeInstallationDirectory: true,
          // installerIcon: 'build/icons/installerIcon.ico',
          // uninstallerIcon: 'build/icons/uninstallerIcon.ico',
          // installerHeaderIcon: 'build/icons/installerHeaderIcon.ico'
        }
      }
    }
  }
}
