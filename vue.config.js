
module.exports = {
  pages: {
    index: {
      entry: 'src/main.js',
      template: 'public/index.html',
      filename: 'index.html',
      chunks: ['chunk-vendors', 'chunk-common', 'index']
    },
    history: {
      entry: 'src/history/main.js',
      template: 'public/history.html',
      filename: 'history.html',
      // 'chunk-chart-vendors' (ADR-0010): sin este chunk explícito acá,
      // history.html no cargaría el código de chart.js/vue-chartjs que el
      // cacheGroup de más abajo separa del resto del vendor bundle.
      chunks: ['chunk-vendors', 'chunk-chart-vendors', 'chunk-common', 'history']
    }
  },
  transpileDependencies: true,
  chainWebpack: (config) => {
    // Confinamiento del bundle de gráficos al historial (ADR-0010,
    // 'charting-library-confined-to-history-bundle'). Sin esto, el
    // `cacheGroup` por defecto de vue-cli-service (`defaultVendors`, con
    // `test: /node_modules/` sin distinguir por entrada) mete chart.js y
    // vue-chartjs en el mismo `chunk-vendors.js` que `index.html` —la
    // ventana del cronómetro, siempre abierta— también carga. Se redeclaran
    // los tres cacheGroups completos porque `splitChunks()` reemplaza el
    // valor entero, no lo mezcla con el de vue-cli-service.
    config.optimization.splitChunks({
      cacheGroups: {
        defaultVendors: {
          name: 'chunk-vendors',
          test: /[\\/]node_modules[\\/](?!(chart\.js|vue-chartjs)[\\/])/,
          priority: -10,
          chunks: 'initial'
        },
        chartVendors: {
          name: 'chunk-chart-vendors',
          test: /[\\/]node_modules[\\/](chart\.js|vue-chartjs)[\\/]/,
          priority: -5,
          chunks: 'initial'
        },
        common: {
          name: 'chunk-common',
          minChunks: 2,
          priority: -20,
          chunks: 'initial',
          reuseExistingChunk: true
        }
      }
    })
  },
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
        appId: 'com.worktracker.app',
        productName: 'Work Tracker',
        publish: [
          {
            provider: 'github',
            owner: 'larayap',
            repo: 'work-tracker',
            releaseType: 'release'
          }
        ],
        win: {
          target: 'nsis',
          icon: 'public/icon-work-256.png',
          executableName: 'Work Tracker'
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
