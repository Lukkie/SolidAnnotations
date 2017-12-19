const path = require('path')

module.exports = {
  entry: [
    './src/annotations.js'
  ],
  output: {
    path: path.join(__dirname, '/out/'),
    filename: 'bundle.js',
    library: 'SolidAnnotations',
    libraryTarget: 'umd'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        // loader: 'babel-loader',
        exclude: /node_modules/
      }
    ]
  },
  externals: [
    'child_process',
    'fs'
  ],
  devtool: 'source-map'
}
