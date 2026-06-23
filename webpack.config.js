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
        vscode: 'commonjs vscode',
        // 可选数据库驱动按运行时动态加载，不参与打包
        mssql: 'commonjs mssql',
        'better-sqlite3': 'commonjs better-sqlite3',
        'ibm_db': 'commonjs ibm_db',
        jdbc: 'commonjs jdbc',
        'jdbc/lib/jinst': 'commonjs jdbc/lib/jinst'
    },
    performance: {
        hints: false
    },
    ignoreWarnings: [
        { module: /node_modules\/mysql2/ },
        { module: /node_modules\/pg/ } // pg-native 可选，纯 JS 模式无需
    ]
};
