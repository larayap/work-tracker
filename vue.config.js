
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
      removeBuildField: true,
      builderOptions: {
        appId: 'com.tuapp.cronometroapps',
        productName: 'Workout',
        publish: [
          {
            provider: 'github',
            owner: 'larayap',
            repo: 'cronometro-app'
          }
        ],
        win: {
          target: 'nsis',
          icon: 'public/icon-work-256.png',
          executableName: 'Workout'
        },
     /*    mac: {
          target: 'dmg',
          // icon: 'build/icons/icon.icns'
        },
        linux: {
          target: 'AppImage',
          // icon: 'build/icons'
        }, */
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
