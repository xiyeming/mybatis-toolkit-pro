/**
 * 驱动加载工具：支持从自定义路径加载原生驱动模块。
 * 如果 driverPath 存在，则从该路径加载；否则使用默认模块名。
 */

export async function loadDriver(moduleName: string, driverPath?: string): Promise<any> {
    const target = driverPath || moduleName;
    try {
        const mod = await import(target);
        return mod;
    } catch (error: any) {
        if (driverPath) {
            throw new Error(`无法从路径加载驱动 "${driverPath}": ${error.message}`);
        }
        throw new Error(`请先安装 ${moduleName} 依赖: npm install ${moduleName}，或配置 driverPath 指向本地驱动路径`);
    }
}
