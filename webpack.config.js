const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: ['./styles/main.sass', 'babel-polyfill', './src/index.ts'],
  mode: 'development',
  target: 'web',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'babel-loader'
          },
          {
            loader: 'ts-loader'
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.sass$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "typings-for-css-modules-loader",
            options: {
                sourceMap: true,
                namedExport: true,
                modules: true,
                importLoaders: 1,
                // url: false
            }
          },
          {
            loader: "sass-loader",
            options: {
                sourceMap: true
            }
          }
        ]
      },
      {
        test: /\.(png|jpg|gif|ttf|fon)$/,
        use: [
          {
            loader: 'file-loader',
            options: {}
          }
        ]
      }
    ]
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: ['.ts', '.sass', '.js']
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Ludum Dare'
    }),
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: '[name].css',
      chunkFilename: '[id].css',
    })
  ]
};
