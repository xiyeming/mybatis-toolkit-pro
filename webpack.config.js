const path = require('path');

module.exports = {
    mode: 'production',
    target: 'node',
    entry: {
        extension: './src/extension.ts'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        libraryTarget: 'commonjs',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    devtool: 'source-map',
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            }
        ]
    },
    externals: {
        vscode: 'commonjs vscode', // Ignored because it's provided by the VS Code host
        // mysql2 might have optional dependencies like 'aws-crt' which cause warnings if not present.
        // We can mark them as external if they cause issues, or let webpack handle them.
        // For now, let's try bundling mysql2.
    },
    performance: {
        hints: false
    },
    ignoreWarnings: [
        { module: /node_modules\/mysql2/ } // Ignore warnings from mysql2 optional deps
    ]
};
