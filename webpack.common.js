const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const package = require('./package.json');
const webpack = require("webpack");

function modifyManifest(buffer) {
  const manifest = JSON.parse(buffer.toString());

  manifest.version = package.version;
  manifest.description = package.description;
  manifest.author = package.author;

  manifest_JSON = JSON.stringify(manifest, null, 2);
  return manifest_JSON;
}

module.exports = {
  entry: {
    popup: path.join(__dirname, "src/popup/index.tsx"),
    background: path.join(__dirname, "src/background/index.ts"),
    inpage: path.join(__dirname, "src/inpage/index.ts"),
    pairing: path.join(__dirname, "src/pairing/index.tsx"),
    sowa: path.join(__dirname, "src/sowa/index.tsx"),
    deploy: path.join(__dirname, "src/deploy/index.tsx"),
    starter: path.join(__dirname, "src/starter/index.tsx"),
    settings: path.join(__dirname, "src/settings/index.tsx"),
    overlay: path.join(__dirname, "src/overlay/index.tsx")
  },
  output: {
    path: path.join(__dirname, "build"),
    filename: "[name].js"
  },
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.tsx?$/,
        use: "ts-loader"
      },
      {
        exclude: /node_modules/,
        test: /\.scss$/,
        use: [
          {
            loader: "style-loader" // Creates style nodes from JS strings
          },
          {
            loader: "css-loader" // Translates CSS into CommonJS
          },
          {
            loader: "sass-loader" // Compiles Sass to CSS
          }
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'resolve-url-loader'],
        include: [
          path.join(__dirname, 'src'),
          /node_modules/
        ]
      },
      {
        test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
        loader: "url-loader",
        options: {
          limit: 10000,
          name: "static/[name].[hash:8].[ext]",
        },
      },
      {
        test: [/\.eot$/, /\.ttf$/, /\.svg$/, /\.woff$/, /\.woff2$/],
        loader: "file-loader",
        options: {
          name: "static/[name].[hash:8].[ext]",
        },
      }
    ]
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        "resources",
        {
          from: "manifest.json",
          to: "manifest.json",
          transform: (content, path) => modifyManifest(content)
        },
        {
          from: "src/background/index.html",
          to: "background.html"
        }, {
          from: "src/popup/index.html",
          to: "popup.html"
        }, {
          from: "src/options/index.html",
          to: "options.html"
        }, {
          from: "src/pairing/index.html",
          to: "pairing.html"
        }, {
          from: "src/sowa/index.html",
          to: "sowa.html"
        }, {
          from: "src/deploy/index.html",
          to: "deploy.html"
        }, {
          from: "src/starter/index.html",
          to: "starter.html"
        }, {
          from: "src/settings/index.html",
          to: "settings.html"
        }, {
          from: "src/overlay/index.html",
          to: "overlay.html"
        }
      ]
    }),
    new webpack.DefinePlugin({
      EXTENSION_VERSION: JSON.stringify(package.version)
    })
  ]
};
