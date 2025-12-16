import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from './DatabaseService';
import { ColumnInfo } from '../types';

export class CodeGenerationService {
    constructor(private dbService: DatabaseService) { }

    public async generateCode(table: string, basePackage: string, workspaceRoot: string) {
        const columns = await this.dbService.getTableSchema(table);
        if (!columns || columns.length === 0) {
            vscode.window.showErrorMessage(`未找到表的列信息: ${table}`);
            return;
        }

        const className = this.toPascalCase(table);
        const entityPackage = `${basePackage}.entity`;
        const mapperPackage = `${basePackage}.mapper`;

        // 生成内容
        const entityContent = this.generateEntity(table, className, entityPackage, columns);
        const mapperInterfaceContent = this.generateMapperInterface(className, entityPackage, mapperPackage);
        const mapperXmlContent = this.generateMapperXml(table, className, entityPackage, mapperPackage, columns);

        // 定义路径
        const srcMainJava = path.join(workspaceRoot, 'src', 'main', 'java');
        const srcMainResources = path.join(workspaceRoot, 'src', 'main', 'resources');

        const entityDir = path.join(srcMainJava, ...entityPackage.split('.'));
        const mapperDir = path.join(srcMainJava, ...mapperPackage.split('.'));
        // 标准 MyBatis Mapper XML 位置: resources/mapper
        const xmlDir = path.join(srcMainResources, 'mapper');

        // 创建目录
        await fs.promises.mkdir(entityDir, { recursive: true });
        await fs.promises.mkdir(mapperDir, { recursive: true });
        await fs.promises.mkdir(xmlDir, { recursive: true });

        // 写入文件
        const entityPath = path.join(entityDir, `${className}.java`);
        const mapperPath = path.join(mapperDir, `${className}Mapper.java`);
        const xmlPath = path.join(xmlDir, `${className}Mapper.xml`);

        await fs.promises.writeFile(entityPath, entityContent, 'utf8');
        await fs.promises.writeFile(mapperPath, mapperInterfaceContent, 'utf8');
        await fs.promises.writeFile(xmlPath, mapperXmlContent, 'utf8');

        // 打开实体类文件
        const doc = await vscode.workspace.openTextDocument(entityPath);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(`已为表 '${table}' 生成代码`);
    }

    private generateEntity(table: string, className: string, packageName: string, columns: ColumnInfo[]): string {
        const fields = columns.map(col => {
            const javaType = this.convertType(col.Type);
            const fieldName = this.toCamelCase(col.Field);
            const comment = col.Comment ? `    /**\n     * ${col.Comment}\n     */\n` : '';
            return `${comment}    private ${javaType} ${fieldName};`;
        }).join('\n\n');

        const hasDate = columns.some(c => this.convertType(c.Type).includes('Date') || this.convertType(c.Type).includes('Time'));
        const imports = [
            'import lombok.Data;',
            'import java.io.Serializable;'
        ];
        if (hasDate) {
            imports.push('import java.time.*;');
            imports.push('import java.util.Date;');
        }

        // 如果需要，简单导入 BigDecimal
        if (columns.some(c => c.Type.toLowerCase().includes('decimal'))) {
            imports.push('import java.math.BigDecimal;');
        }

        return `package ${packageName};

${imports.join('\n')}

/**
 * Table: ${table}
 */
@Data
public class ${className} implements Serializable {
    private static final long serialVersionUID = 1L;

${fields}
}
`;
    }

    private generateMapperInterface(className: string, entityPackage: string, mapperPackage: string): string {
        return `package ${mapperPackage};

import ${entityPackage}.${className};
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface ${className}Mapper {

    int insert(${className} record);

    int insertSelective(${className} record);

    int updateByPrimaryKey(${className} record);
    
    int updateByPrimaryKeySelective(${className} record);

    int deleteByPrimaryKey(@Param("id") Long id);

    ${className} selectByPrimaryKey(@Param("id") Long id);

    List<${className}> selectAll();
}
`;
    }

    private generateMapperXml(table: string, className: string, entityPackage: string, mapperPackage: string, columns: ColumnInfo[]): string {
        const fullEntityName = `${entityPackage}.${className}`;
        const namespace = `${mapperPackage}.${className}Mapper`;

        // 结果映射
        const resultResults = columns.map(col => {
            const property = this.toCamelCase(col.Field);
            // 假设第一个字段是 ID 或查找 'id'/'PRIMARY' 键？
            // 简化：如果 Key='PRI'，将 'id' 或第一个列视为 ID
            const isId = col.Key === 'PRI';
            const tag = isId ? 'id' : 'result';
            return `        <${tag} column="${col.Field}" property="${property}" />`;
        }).join('\n');

        // 基础列列表
        const columnList = columns.map(c => `        ${c.Field}`).join(',\n');
        const insertCols = columns.map(c => c.Field).join(', ');
        const insertVals = columns.map(c => `#{${this.toCamelCase(c.Field)}}`).join(', ');

        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="${namespace}">

    <resultMap id="BaseResultMap" type="${fullEntityName}">
${resultResults}
    </resultMap>

    <sql id="Base_Column_List">
${columnList}
    </sql>

    <select id="selectByPrimaryKey" resultMap="BaseResultMap">
        select 
        <include refid="Base_Column_List" />
        from ${table}
        where id = #{id}
    </select>

    <delete id="deleteByPrimaryKey">
        delete from ${table}
        where id = #{id}
    </delete>

    <insert id="insert" parameterType="${fullEntityName}">
        insert into ${table} (${insertCols})
        values (${insertVals})
    </insert>

    <select id="selectAll" resultMap="BaseResultMap">
        select 
        <include refid="Base_Column_List" />
        from ${table}
    </select>
</mapper>
`;
    }

    /**
     * 辅助方法: snake_case 转 CamelCase
     */
    private toCamelCase(str: string): string {
        return str.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    }

    /**
     * 辅助方法: snake_case 转 PascalCase (类名)
     */
    private toPascalCase(str: string): string {
        const camel = this.toCamelCase(str);
        return camel.charAt(0).toUpperCase() + camel.slice(1);
    }

    private convertType(sqlType: string): string {
        const t = sqlType.toLowerCase();
        if (t.includes('bit') || t.includes('boolean')) return 'Boolean';
        if (t.includes('tinyint')) return 'Integer'; // or Byte
        if (t.includes('bigint')) return 'Long';
        if (t.includes('int')) return 'Integer';
        if (t.includes('decimal') || t.includes('numeric')) return 'BigDecimal';
        if (t.includes('float')) return 'Float';
        if (t.includes('double')) return 'Double';
        if (t.includes('date') || t.includes('time') || t.includes('year')) {
            if (t === 'date') return 'LocalDate';
            if (t === 'time') return 'LocalTime';
            return 'LocalDateTime';
        }
        return 'String';
    }
}
