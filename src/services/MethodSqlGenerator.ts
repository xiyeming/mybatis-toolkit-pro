import { ProjectIndexer } from './ProjectIndexer';
import { JavaClass } from '../types';

export class MethodSqlGenerator {
    constructor(private indexer: ProjectIndexer) { }

    public generateSql(
        methodName: string,
        returnType: string,
        params: { name: string; type: string }[],
        className: string
    ): string {
        // 1. 确定操作类型
        const type = this.getOperationType(methodName);
        if (!type) return '';

        // 2. 解析实体 (模拟检查或约定)
        // 假设实体名称派生自接口名称 (UserMapper -> User)
        // 或派生自返回类型 (List<User> -> User)
        let entityName = '';
        const interfaceSimpleName = className.split('.').pop() || '';
        const possibleEntity = interfaceSimpleName.replace('Mapper', '');

        // 尝试验证此实体是否存在于索引中
        // 简单启发式：PascalCase 转下划线 (User -> user)
        const tableName = this.camelToSnake(possibleEntity);

        // 3. 构建 SQL
        let sql = '';
        let baseNode = '';

        switch (type) {
            case 'select':
                {
                    const condition = this.parseCondition(methodName, 'select', params);
                    // 标准 MyBatis select 查询
                    baseNode = `<select id="${methodName}" resultMap="BaseResultMap">\n`;
                    baseNode += `    select <include refid="Base_Column_List" />\n`;
                    baseNode += `    from ${tableName}\n`;
                    if (condition) {
                        baseNode += `    where ${condition}`;
                    }
                    baseNode += `\n  </select>`;
                }
                break;
            case 'update':
                {
                    const condition = this.parseCondition(methodName, 'update', params);
                    baseNode = `<update id="${methodName}">\n`;
                    baseNode += `    update ${tableName}\n`;
                    baseNode += `    set <!-- TODO: 添加字段 -->\n`;
                    if (condition) {
                        baseNode += `    where ${condition}`;
                    }
                    baseNode += `\n  </update>`;
                }
                break;
            case 'delete':
                {
                    const condition = this.parseCondition(methodName, 'delete', params);
                    baseNode = `<delete id="${methodName}">\n`;
                    baseNode += `    delete from ${tableName}\n`;
                    if (condition) {
                        baseNode += `    where ${condition}`;
                    }
                    baseNode += `\n  </delete>`;
                }
                break;
            case 'insert':
                baseNode = `<insert id="${methodName}" parameterType="${possibleEntity}">\n`;
                baseNode += `    insert into ${tableName} (<!-- 字段 -->)\n`;
                baseNode += `    values (<!-- 值 -->)\n`;
                baseNode += `  </insert>`;
                break;
            case 'count':
                {
                    const condition = this.parseCondition(methodName, 'count', params);
                    baseNode = `<select id="${methodName}" resultType="java.lang.Long">\n`;
                    baseNode += `    select count(*)\n`;
                    baseNode += `    from ${tableName}\n`;
                    if (condition) {
                        baseNode += `    where ${condition}`;
                    }
                    baseNode += `\n  </select>`;
                }
                break;
        }

        return baseNode;
    }

    private getOperationType(name: string): string | null {
        if (name.startsWith('select') || name.startsWith('find') || name.startsWith('get') || name.startsWith('query')) return 'select';
        if (name.startsWith('update') || name.startsWith('modify')) return 'update';
        if (name.startsWith('delete') || name.startsWith('remove')) return 'delete';
        if (name.startsWith('insert') || name.startsWith('add') || name.startsWith('save')) return 'insert';
        if (name.startsWith('count')) return 'count';
        return null;
    }

    private parseCondition(methodName: string, opType: string, params: { name: string; type: string }[]): string {
        // 去除前缀 (find, select...)
        let rest = methodName.replace(/^(select|find|get|query|update|modify|delete|remove|count)(By)?/, '');
        if (!rest) return ''; // 无条件 (例如 selectAll)

        // 按 And / Or 分割
        const conditions: string[] = [];
        // 使用正则分割 And/Or 但保留分隔符
        const parts = rest.split(/(And|Or)/);

        let paramIndex = 0;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part === 'And' || part === 'Or') {
                conditions.push(part.toUpperCase());
                continue;
            }
            if (!part) continue;

            const field = this.camelToSnake(this.lowerFirst(part));
            // 检查 Like, In, Between 后缀
            if (field.endsWith('_like')) {
                const realField = field.replace('_like', '');
                const pName = params[paramIndex]?.name || realField;
                conditions.push(`${realField} like concat('%', #{${pName}}, '%')`);
                paramIndex++;
            } else if (field.endsWith('_in')) {
                const realField = field.replace('_in', '');
                const pName = params[paramIndex]?.name || 'list';
                conditions.push(`${realField} in \n    <foreach item="item" collection="${pName}" open="(" separator="," close=")">#{item}</foreach>`);
                paramIndex++;
            } else {
                // 等于
                const pName = params[paramIndex]?.name || this.lowerFirst(part);
                conditions.push(`${field} = #{${pName}}`);
                paramIndex++;
            }
        }

        return conditions.join(' ');
    }

    private camelToSnake(str: string): string {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }

    private lowerFirst(str: string): string {
        return str.charAt(0).toLowerCase() + str.slice(1);
    }
}
