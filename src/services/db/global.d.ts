// 可选数据库驱动，运行时动态加载；声明为 any 避免未安装时 TypeScript 报错
declare module 'mssql';
declare module 'better-sqlite3';
declare module 'ibm_db';
declare module 'jdbc';
declare module 'jdbc/lib/jinst';
