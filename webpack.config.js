const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const devMode = argv.mode !== 'production';
  return {
    entry: './client/main.tsx',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.s[ac]ss$/i,
          use: [
            devMode ? 'style-loader' : {
              loader: MiniCssExtractPlugin.loader,
              options: {
                hmr: false,
                reloadAll: true
              },
            },
            'css-loader', 'sass-loader'
          ],
        },
        {
          test: /\.(png|jpe?g|gif|svg|txt)$/i,
          type: 'asset/resource',
        },
      ],
    },
    devServer: {
      static: './dist',
      hot: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4014',
          pathRewrite: {'^/api': ''},
          changeOrigin: true,
        },
      }
    },
    resolve: {
      extensions: [ '.tsx', '.ts', '.js' ],
    },
    output: {
      filename: devMode ? '[name].js' : '[name].[contenthash].js',
      chunkFilename: devMode ? '[name].js' : '[name].[contenthash].js',
      path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
      new HtmlWebpackPlugin({
        hash: true,
        template: './client/index.html',
      }),
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: devMode ? '[name].css' : '[name].[hash].css',
        chunkFilename: devMode ? '[id].css' : '[id].[hash].css',
      }),
      new CopyPlugin({
        patterns: [
          { from: './client/static', to: '' },
        ]
      }),
      new webpack.NormalModuleReplacementPlugin(
        /config\/environment\.tsx/,
        devMode ? './environment.tsx' : './environment.prod.tsx'
      ),
      new webpack.ProvidePlugin({
        // Make a global `process` variable that points to the `process` package,
        // because the `util` package expects there to be a global variable named `process`.
        // Thanks to https://stackoverflow.com/a/65018686/14239942
        process: 'process/browser'
      }),
    ],
    optimization: {
      splitChunks: {
        cacheGroups: {
          styles: {
            name: 'styles',
            test: /\.css$/,
            chunks: 'all',
            enforce: true,
          },
        },
      },
    },
  };
};
