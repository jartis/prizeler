const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: {
      main: './script.js',
      styles: './styles.css'
    },
    output: {
      filename: isProduction ? 'js/[name].[contenthash].min.js' : 'js/[name].js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
      publicPath: './',
    },
    
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader'
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'images/[name][ext]',
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name][ext]',
          },
        },
      ],
    },
    
    plugins: [
      new HtmlWebpackPlugin({
        template: './index.html',
        filename: 'index.html',
        inject: 'body',
        chunks: ['main', 'styles'],
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true,
        } : false,
      }),
      
      ...(isProduction ? [
        new MiniCssExtractPlugin({
          filename: 'css/[name].[contenthash].min.css',
        }),
      ] : []),
      
      new CopyWebpackPlugin({
        patterns: [
          {
            from: '*.json',
            to: '[name][ext]',
            globOptions: {
              ignore: ['**/package*.json', '**/node_modules/**'],
            },
          },
        ],
      }),
    ],
    
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction,
              drop_debugger: isProduction,
            },
            mangle: {
              // Preserve function names that are used in HTML onclick attributes
              reserved: [
                'switchTab', 'addNewPrizePack', 'loadPrizePackFile', 'exportPrizePackData', 
                'clearAllPrizePacks', 'filterPrizePacks', 'deletePrizePack', 'editPrizePack',
                'addNewDonation', 'loadDonationFile', 'exportDonationData', 'showUserSummary',
                'clearAllDonations', 'filterDonations', 'clearDateFilter', 'deleteDonation',
                'editDonation', 'loadSampleData', 'runAllDrawings', 'resetAllDrawings',
                'saveAllDrawingResults', 'showDrawingHistory', 'conductSingleDrawing',
                'resetSingleDrawing', 'closePrizePackModal', 'closeDonationModal',
                'closeUserSummary', 'conductDrawing', 'cancelDrawing', 'saveDrawingResults',
                'startNewDrawing'
              ]
            },
            format: {
              comments: false,
            },
          },
          extractComments: false,
        }),
      ],
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    },
    
    resolve: {
      extensions: ['.js', '.json'],
    },
    
    devServer: {
      static: {
        directory: path.join(__dirname, 'dist'),
      },
      compress: true,
      port: 3000,
      open: true,
      hot: true,
    },
    
    devtool: isProduction ? false : 'eval-source-map',
  };
};
