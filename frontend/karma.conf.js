// Karma configuration file, see link for more information
// https://karma-runner.github.io/6.4/config/configuration-file.html

// Auto-detect Brave browser if Chrome is not installed
if (!process.env.CHROME_BIN) {
  const fs = require('fs');
  const bravePaths = [
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    process.env.LOCALAPPDATA + '\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  ];
  for (const p of bravePaths) {
    if (fs.existsSync(p)) {
      process.env.CHROME_BIN = p;
      break;
    }
  }
}

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // Configuración de Jasmine
        random: true, // Ejecutar tests en orden aleatorio
        seed: 42,     // Semilla para reproducibilidad
        stopSpecOnExpectationFailure: false,
        randomOptions: { seed: 42, running: true }
      },
      clearContext: false // Mantener el iframe de Jasmine visible
    },
    jasmineHtmlReporter: {
      // Mostrar solo los tests que fallan
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/frontend'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcov' }
      ],
      // Archivos a excluir del coverage
      exclude: [
        '**/*.module.ts',
        '**/*.routes.ts',
        '**/index.ts',
        '**/main.ts',
        '**/polyfills.ts',
        '**/*.conf.ts'
      ]
    },
    reporters: ['progress', 'kjhtml', 'coverage'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,        // Recargar tests automáticamente cuando hay cambios
    browsers: ['ChromeHeadlessNoSandbox'],    // Navegador por defecto
    singleRun: false,        // No cerrar después de ejecutar (modo watch)
    restartOnFileChange: true,
    customLaunchers: {
      // ChromeHeadlessNoSandbox usa ChromeHeadless como base (no同名)
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-translate',
          '--disable-extensions',
          '--disable-dev-shm-usage',
          '--js-flags=--max-old-space-size=4096'
        ]
      }
    }
  });
};
