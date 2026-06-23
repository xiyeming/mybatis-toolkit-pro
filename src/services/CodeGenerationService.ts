import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from './DatabaseService';
import { ColumnInfo } from '../types';
import { getMybatisPlusCodeGenConfig, getCodeGenDirNames } from '../config';

export type CodeGenStyle = 'mybatis-plus' | 'mybatis';

export class CodeGenerationService {
    private outputChannel: vscode.OutputChannel;

    constructor(private dbService: DatabaseService, outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    public async generateCode(table: string, basePackage: string, workspaceRoot: string, style: CodeGenStyle = 'mybatis-plus') {
        this.outputChannel.appendLine(`[代码生成] 开始: 表=${table}, 包=${basePackage}, 风格=${style}, 目录=${workspaceRoot}`);
        const start = Date.now();
        try {
            const columns = await this.dbService.getTableSchema(table);
            if (!columns || columns.length === 0) {
                this.outputChannel.appendLine(`[代码生成] 失败: 未找到表 ${table} 的列信息`);
                vscode.window.showErrorMessage(`未找到表的列信息: ${table}`);
                return;
            }
            this.outputChannel.appendLine(`[代码生成] 获取到 ${columns.length} 列，主键列=${columns.find(c => c.Key === 'PRI')?.Field ?? columns[0]?.Field ?? 'id'}`);

            const className = this.toPascalCase(table);
            const dirNames = getCodeGenDirNames();
            const entityPackage = `${basePackage}.${dirNames.entityDirName}`;
            const mapperPackage = `${basePackage}.${dirNames.mapperDirName}`;
            const servicePackage = `${basePackage}.${dirNames.serviceDirName}`;

            // 主键列：优先 PRI，否则首列，否则 'id'
            const idColumn = columns.find(c => c.Key === 'PRI')?.Field ?? columns[0]?.Field ?? 'id';
            const idProperty = this.toCamelCase(idColumn);

            const entityContent = this.generateEntity(table, className, entityPackage, columns, idColumn, idProperty, style);
            const mapperInterfaceContent = this.generateMapperInterface(className, entityPackage, mapperPackage, idColumn, idProperty, style);
            const mapperXmlContent = this.generateMapperXml(table, className, entityPackage, mapperPackage, columns, idColumn, idProperty, style);
            const serviceContent = this.generateServiceInterface(className, entityPackage, servicePackage, style);
            const serviceImplContent = this.generateServiceImpl(className, entityPackage, mapperPackage, servicePackage, style);

            const srcMainJava = path.join(workspaceRoot, 'src', 'main', 'java');
            const srcMainResources = path.join(workspaceRoot, 'src', 'main', 'resources');

            const entityDir = path.join(srcMainJava, ...entityPackage.split('.'));
            const mapperDir = path.join(srcMainJava, ...mapperPackage.split('.'));
            const serviceDir = path.join(srcMainJava, ...servicePackage.split('.'));
            const serviceImplDir = path.join(serviceDir, 'impl');
            const xmlDir = path.join(srcMainResources, dirNames.xmlDirName);

            await fs.promises.mkdir(entityDir, { recursive: true });
            await fs.promises.mkdir(mapperDir, { recursive: true });
            await fs.promises.mkdir(serviceImplDir, { recursive: true });
            await fs.promises.mkdir(xmlDir, { recursive: true });

            const entityPath = path.join(entityDir, `${className}.java`);
            const mapperPath = path.join(mapperDir, `${className}Mapper.java`);
            const xmlPath = path.join(xmlDir, `${className}Mapper.xml`);
            const servicePath = path.join(serviceDir, `${className}Service.java`);
            const serviceImplPath = path.join(serviceImplDir, `${className}ServiceImpl.java`);

            await fs.promises.writeFile(entityPath, entityContent, 'utf8');
            await fs.promises.writeFile(mapperPath, mapperInterfaceContent, 'utf8');
            await fs.promises.writeFile(xmlPath, mapperXmlContent, 'utf8');
            await fs.promises.writeFile(servicePath, serviceContent, 'utf8');
            await fs.promises.writeFile(serviceImplPath, serviceImplContent, 'utf8');

            this.outputChannel.appendLine(`[代码生成] 文件已写入:`);
            this.outputChannel.appendLine(`  Entity:     ${entityPath}`);
            this.outputChannel.appendLine(`  Mapper:     ${mapperPath}`);
            this.outputChannel.appendLine(`  XML:        ${xmlPath}`);
            this.outputChannel.appendLine(`  Service:    ${servicePath}`);
            this.outputChannel.appendLine(`  ServiceImpl:${serviceImplPath}`);

            const doc = await vscode.workspace.openTextDocument(entityPath);
            await vscode.window.showTextDocument(doc);
            const elapsed = Date.now() - start;
            this.outputChannel.appendLine(`[代码生成] 完成: ${table} → ${className} (耗时 ${elapsed}ms)`);
            vscode.window.showInformationMessage(`已为表 '${table}' 生成 Entity、Mapper、XML、Service、ServiceImpl`);
        } catch (e) {
            const elapsed = Date.now() - start;
            const msg = e instanceof Error ? e.message : String(e);
            this.outputChannel.appendLine(`[代码生成] 异常 (${elapsed}ms): ${msg}`);
            vscode.window.showErrorMessage(`生成代码失败: ${msg}`);
        }
    }

    private generateEntity(table: string, className: string, packageName: string, columns: ColumnInfo[], idColumn: string, idProperty: string, style: CodeGenStyle): string {
        const hasDate = columns.some(c => this.convertType(c.Type).includes('Date') || this.convertType(c.Type).includes('Time'));
        const imports = ['import lombok.Data;', 'import java.io.Serializable;'];
        if (hasDate) {
            imports.push('import java.time.*;');
        }
        if (columns.some(c => c.Type.toLowerCase().includes('decimal'))) {
            imports.push('import java.math.BigDecimal;');
        }

        if (style === 'mybatis-plus') {
            imports.push('import com.baomidou.mybatisplus.annotation.TableName;');
            imports.push('import com.baomidou.mybatisplus.annotation.TableId;');
            imports.push('import com.baomidou.mybatisplus.annotation.TableField;');
            imports.push('import com.baomidou.mybatisplus.annotation.IdType;');
            imports.push('import com.baomidou.mybatisplus.annotation.TableLogic;');
            imports.push('import com.baomidou.mybatisplus.annotation.FieldFill;');
        }

        const mpConfig = style === 'mybatis-plus' ? getMybatisPlusCodeGenConfig() : null;
        const fillMap = mpConfig ? new Map(mpConfig.fillFields.map(f => [f.column, f.fill])) : null;
        const logicDeleteCol = mpConfig?.logicDeleteField ?? '';
        const idType = mpConfig?.idType ?? 'AUTO';

        const fields = columns.map(col => {
            const javaType = this.convertType(col.Type);
            const fieldName = this.toCamelCase(col.Field);
            const comment = col.Comment ? `    /**\n     * ${col.Comment}\n     */\n` : '';
            const isId = col.Key === 'PRI';
            let annotations = '';
            if (style === 'mybatis-plus') {
                if (isId) {
                    annotations = `    @TableId(value = "${col.Field}", type = IdType.${idType})\n`;
                } else {
                    const isLogicDelete = logicDeleteCol && col.Field === logicDeleteCol;
                    const fill = fillMap?.get(col.Field);
                    if (isLogicDelete) {
                        annotations = `    @TableLogic\n`;
                        if (fill) {
                            annotations += `    @TableField(value = "${col.Field}", fill = FieldFill.${fill})\n`;
                        } else if (col.Field !== fieldName) {
                            annotations += `    @TableField("${col.Field}")\n`;
                        }
                    } else if (fill) {
                        annotations = `    @TableField(value = "${col.Field}", fill = FieldFill.${fill})\n`;
                    } else if (col.Field !== fieldName) {
                        annotations = `    @TableField("${col.Field}")\n`;
                    }
                }
            }
            return `${comment}${annotations}    private ${javaType} ${fieldName};`;
        }).join('\n\n');

        return `package ${packageName};

${imports.join('\n')}

/**
 * Table: ${table}
 */
@Data${style === 'mybatis-plus' ? `\n@TableName("${table}")` : ''}
public class ${className} implements Serializable {
    private static final long serialVersionUID = 1L;

${fields}
}
`;
    }

    private generateMapperInterface(className: string, entityPackage: string, mapperPackage: string, idColumn: string, idProperty: string, style: CodeGenStyle): string {
        if (style === 'mybatis-plus') {
            return `package ${mapperPackage};

import ${entityPackage}.${className};
import org.apache.ibatis.annotations.Mapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;

@Mapper
public interface ${className}Mapper extends BaseMapper<${className}> {

}
`;
        }
        const idType = 'Long';
        const paramName = idProperty || 'id';
        return `package ${mapperPackage};

import ${entityPackage}.${className};
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface ${className}Mapper {

    int insert(${className} record);

    int insertSelective(${className} record);

    int updateById(${className} record);

    int updateByIdSelective(${className} record);

    int deleteById(@Param("${paramName}") ${idType} ${paramName});

    ${className} selectById(@Param("${paramName}") ${idType} ${paramName});

    List<${className}> selectAll();
}
`;
    }

    private generateMapperXml(table: string, className: string, entityPackage: string, mapperPackage: string, columns: ColumnInfo[], idColumn: string, idProperty: string, style: CodeGenStyle): string {
        const fullEntityName = `${entityPackage}.${className}`;
        const namespace = `${mapperPackage}.${className}Mapper`;

        const resultResults = columns.map(col => {
            const property = this.toCamelCase(col.Field);
            const isId = col.Key === 'PRI';
            const tag = isId ? 'id' : 'result';
            return `        <${tag} column="${col.Field}" property="${property}" />`;
        }).join('\n');

        const columnList = columns.map(c => `        ${c.Field}`).join(',\n');

        if (style === 'mybatis-plus') {
            return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="${namespace}">

    <resultMap id="BaseResultMap" type="${fullEntityName}">
${resultResults}
    </resultMap>

    <sql id="Base_Column_List">
${columnList}
    </sql>

    <!-- 自定义 SQL 可在此添加，CRUD 由 BaseMapper 提供 -->
</mapper>
`;
        }

        const insertCols = columns.map(c => c.Field).join(', ');
        const insertVals = columns.map(c => `#{${this.toCamelCase(c.Field)}}`).join(', ');
        const updateSets = columns
            .filter(c => c.Field !== idColumn)
            .map(c => `        ${c.Field} = #{${this.toCamelCase(c.Field)}}`)
            .join(',\n');

        const insertSelectiveCols = columns.map(c => {
            const prop = this.toCamelCase(c.Field);
            return `            <if test="${prop} != null">${c.Field},</if>`;
        }).join('\n');
        const insertSelectiveVals = columns.map(c => {
            const prop = this.toCamelCase(c.Field);
            return `            <if test="${prop} != null">#{${prop}},</if>`;
        }).join('\n');

        const updateSetsSelective = columns
            .filter(c => c.Field !== idColumn)
            .map(c => {
                const prop = this.toCamelCase(c.Field);
                return `            <if test="${prop} != null">${c.Field} = #{${prop}},</if>`;
            })
            .join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="${namespace}">

    <resultMap id="BaseResultMap" type="${fullEntityName}">
${resultResults}
    </resultMap>

    <sql id="Base_Column_List">
${columnList}
    </sql>

    <insert id="insert" parameterType="${fullEntityName}">
        insert into ${table} (${insertCols})
        values (${insertVals})
    </insert>

    <insert id="insertSelective" parameterType="${fullEntityName}">
        insert into ${table}
        <trim prefix="(" suffix=")" suffixOverrides=",">
${insertSelectiveCols}
        </trim>
        <trim prefix="values (" suffix=")" suffixOverrides=",">
${insertSelectiveVals}
        </trim>
    </insert>

    <update id="updateById" parameterType="${fullEntityName}">
        update ${table}
        set
${updateSets}
        where ${idColumn} = #{${idProperty}}
    </update>

    <update id="updateByIdSelective" parameterType="${fullEntityName}">
        update ${table}
        <set>
${updateSetsSelective}
        </set>
        where ${idColumn} = #{${idProperty}}
    </update>

    <delete id="deleteById">
        delete from ${table}
        where ${idColumn} = #{${idProperty}}
    </delete>

    <select id="selectById" resultMap="BaseResultMap">
        select
        <include refid="Base_Column_List" />
        from ${table}
        where ${idColumn} = #{${idProperty}}
    </select>

    <select id="selectAll" resultMap="BaseResultMap">
        select
        <include refid="Base_Column_List" />
        from ${table}
    </select>
</mapper>
`;
    }

    private generateServiceInterface(className: string, entityPackage: string, servicePackage: string, style: CodeGenStyle): string {
        if (style === 'mybatis-plus') {
            return `package ${servicePackage};

import ${entityPackage}.${className};
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * ${className} Service 接口
 */
public interface ${className}Service extends IService<${className}> {

}
`;
        }
        return `package ${servicePackage};

import ${entityPackage}.${className};
import java.util.List;

/**
 * ${className} Service 接口
 */
public interface ${className}Service {

    int insert(${className} record);

    int deleteById(Long id);

    int updateById(${className} record);

    ${className} selectById(Long id);

    List<${className}> selectAll();
}
`;
    }

    private generateServiceImpl(className: string, entityPackage: string, mapperPackage: string, servicePackage: string, style: CodeGenStyle): string {
        const mapperClass = `${className}Mapper`;
        const mapperField = this.toCamelCase(className) + 'Mapper';
        if (style === 'mybatis-plus') {
            return `package ${servicePackage}.impl;

import ${entityPackage}.${className};
import ${mapperPackage}.${mapperClass};
import ${servicePackage}.${className}Service;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

/**
 * ${className} Service 实现类
 */
@Service
public class ${className}ServiceImpl extends ServiceImpl<${mapperClass}, ${className}> implements ${className}Service {

}
`;
        }
        return `package ${servicePackage}.impl;

import ${entityPackage}.${className};
import ${mapperPackage}.${mapperClass};
import ${servicePackage}.${className}Service;
import org.springframework.stereotype.Service;
import javax.annotation.Resource;
import java.util.List;

/**
 * ${className} Service 实现类
 */
@Service
public class ${className}ServiceImpl implements ${className}Service {

    @Resource
    private ${mapperClass} ${mapperField};

    @Override
    public int insert(${className} record) {
        return ${mapperField}.insert(record);
    }

    @Override
    public int deleteById(Long id) {
        return ${mapperField}.deleteById(id);
    }

    @Override
    public int updateById(${className} record) {
        return ${mapperField}.updateById(record);
    }

    @Override
    public ${className} selectById(Long id) {
        return ${mapperField}.selectById(id);
    }

    @Override
    public List<${className}> selectAll() {
        return ${mapperField}.selectAll();
    }
}
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
