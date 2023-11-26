const path = require("path");
module.exports = (env) => {
  const mode = env.mode || "development";
  const entry = path.resolve(__dirname, "src", "index.js");
  const build = path.resolve(__dirname, "dist");

  return {
    mode,
    entry,
    output: {
      filename: "bundle.js",
      path: build,
      clean: true

    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                ["@babel/preset-env", { targets: "defaults" }]
              ]
            }
          }
        }
      ]
    }
  };
};