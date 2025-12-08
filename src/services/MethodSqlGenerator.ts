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
        // 1. Determine Operation Type
        const type = this.getOperationType(methodName);
        if (!type) return '';

        // 2. Resolve Entity (Mock check or convention)
        // Assume Entity name is derived from Interface name (UserMapper -> User)
        // Or from return type (List<User> -> User)
        let entityName = '';
        const interfaceSimpleName = className.split('.').pop() || '';
        const possibleEntity = interfaceSimpleName.replace('Mapper', '');

        // Try to verify if this entity exists in indexer
        // Simple heuristic: To pascal case to underscore (User -> user)
        const tableName = this.camelToSnake(possibleEntity);

        // 3. Build SQL
        let sql = '';
        let baseNode = '';

        switch (type) {
            case 'select':
                {
                    const condition = this.parseCondition(methodName, 'select', params);
                    // Standard MyBatis select
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
                    baseNode += `    set <!-- TODO: Add fields -->\n`;
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
                baseNode += `    insert into ${tableName} (<!-- fields -->)\n`;
                baseNode += `    values (<!-- values -->)\n`;
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
        // Strip prefix (find, select...)
        let rest = methodName.replace(/^(select|find|get|query|update|modify|delete|remove|count)(By)?/, '');
        if (!rest) return ''; // No condition (e.g. selectAll)

        // Split by And / Or
        const conditions: string[] = [];
        // Regex to split by And/Or but keep delimiter
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
            // Check for Like, In, Between suffix
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
                // Equals
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
