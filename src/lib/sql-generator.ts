import { Node, Edge } from 'reactflow';
import { Column, TableIndex } from '@/components/editor/nodes/table-node';

export interface SQLOptions {
    includeComments?: boolean;
    includeIfNotExists?: boolean;
    includeForeignKeys?: boolean;
    includeIndexes?: boolean;
    dropTables?: boolean;
    selectedOnly?: boolean;
    selectedNodes?: string[];
}

export interface SQLGenerationResult {
    sql: string;
    warnings: string[];
    errors: string[];
}

export class SQLGenerator {
    private nodes: Node[];
    private edges: Edge[];
    private options: SQLOptions;

    constructor(nodes: Node[], edges: Edge[], options: SQLOptions = {}) {
        this.nodes = nodes;
        this.edges = edges;
        this.options = {
            includeComments: true,
            includeIfNotExists: true,
            includeForeignKeys: true,
            includeIndexes: true,
            dropTables: false,
            selectedOnly: false,
            selectedNodes: [],
            ...options
        };
    }

    generate(): SQLGenerationResult {
        const warnings: string[] = [];
        const errors: string[] = [];
        let sql = '';

        try {
            // Filter nodes based on selection
            const relevantNodes = this.getRelevantNodes();

            if (relevantNodes.length === 0) {
                warnings.push('No tables to export');
                return { sql: '', warnings, errors };
            }

            // Add header comment
            if (this.options.includeComments) {
                sql += this.generateHeader();
            }

            // Add DROP statements if requested
            if (this.options.dropTables) {
                sql += this.generateDropStatements(relevantNodes);
            }

            // Generate CREATE TABLE statements
            sql += this.generateCreateTableStatements(relevantNodes, warnings);

            // Generate foreign key constraints
            if (this.options.includeForeignKeys) {
                sql += this.generateForeignKeyConstraints(relevantNodes, warnings);
            }

            // Generate indexes
            if (this.options.includeIndexes) {
                sql += this.generateIndexes(relevantNodes, warnings);
            }

            return { sql, warnings, errors };
        } catch (error) {
            errors.push(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return { sql: '', warnings, errors };
        }
    }

    private getRelevantNodes(): Node[] {
        if (this.options.selectedOnly && this.options.selectedNodes) {
            return this.nodes.filter(node =>
                node.type === 'table' && this.options.selectedNodes!.includes(node.id)
            );
        }
        return this.nodes.filter(node => node.type === 'table');
    }

    private generateHeader(): string {
        const timestamp = new Date().toISOString();
        const tableCount = this.getRelevantNodes().length;

        return `-- Generated SQL Schema
-- Generated on: ${timestamp}
-- Tables: ${tableCount}
-- ERD SchemaFlow SQL Generator

`;
    }

    private generateDropStatements(nodes: Node[]): string {
        let sql = '-- Drop existing tables\n\n';

        // Drop in reverse order to handle foreign key dependencies
        const sortedNodes = [...nodes].reverse();

        for (const node of sortedNodes) {
            const tableName = node.data.label;
            sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
        }

        return sql + '\n';
    }

    private generateCreateTableStatements(nodes: Node[], warnings: string[]): string {
        let sql = '-- Create tables\n\n';

        for (const node of nodes) {
            const tableName = node.data.label;
            const columns = node.data.columns || [];
            const engine = node.data.engine || 'InnoDB';
            const collation = node.data.collation;
            const comment = node.data.comment;

            // Validate table name
            if (!this.isValidIdentifier(tableName)) {
                warnings.push(`Invalid table name: ${tableName}`);
                continue;
            }

            sql += `CREATE TABLE`;
            if (this.options.includeIfNotExists) {
                sql += ` IF NOT EXISTS`;
            }
            sql += ` \`${tableName}\` (\n`;

            // Generate columns
            const columnDefinitions = columns.map((column: Column) =>
                this.generateColumnDefinition(column, warnings)
            ).filter(Boolean);

            if (columnDefinitions.length === 0) {
                warnings.push(`Table ${tableName} has no valid columns`);
                continue;
            }

            sql += columnDefinitions.join(',\n');

            // Add primary key if exists
            const primaryKeys = columns.filter((col: Column) => col.isPrimaryKey);
            if (primaryKeys.length > 0) {
                const pkColumns = primaryKeys.map((col: Column) => `\`${col.name}\``).join(', ');
                sql += `,\n  PRIMARY KEY (${pkColumns})`;
            }

            sql += '\n)';

            // Add engine specification
            sql += ` ENGINE=${engine}`;

            // Add collation if specified
            if (collation) {
                sql += ` COLLATE=${collation}`;
            }

            // Add table comment if specified
            if (comment && this.options.includeComments) {
                sql += ` COMMENT='${this.escapeString(comment)}'`;
            }

            sql += ';\n\n';
        }

        return sql;
    }

    private generateColumnDefinition(column: Column, warnings: string[]): string {
        const { name, type, isNullable, isUnique, defaultValue, autoIncrement, comment } = column;

        // Validate column name
        if (!this.isValidIdentifier(name)) {
            warnings.push(`Invalid column name: ${name}`);
            return '';
        }

        // Fix data type issues
        let mysqlType = this.normalizeDataType(type, name, warnings);

        let definition = `  \`${name}\` ${mysqlType}`;

        // Add NOT NULL or NULL
        if (!isNullable) {
            definition += ' NOT NULL';
        }

        // Add default value
        if (defaultValue !== undefined && defaultValue !== null) {
            if (defaultValue.toString().toUpperCase() === 'NULL') {
                definition += ' DEFAULT NULL';
            } else if (defaultValue.toString().toUpperCase() === 'CURRENT_TIMESTAMP') {
                definition += ' DEFAULT CURRENT_TIMESTAMP';
            } else if (this.isNumericType(mysqlType)) {
                definition += ` DEFAULT ${defaultValue}`;
            } else {
                definition += ` DEFAULT '${this.escapeString(defaultValue.toString())}'`;
            }
        }

        // Add auto increment
        if (autoIncrement && isNullable === false) {
            definition += ' AUTO_INCREMENT';
        }

        // Add unique constraint (but not for primary keys)
        if (isUnique && !column.isPrimaryKey) {
            definition += ' UNIQUE';
        }

        // Add column comment
        if (comment && this.options.includeComments) {
            definition += ` COMMENT '${this.escapeString(comment)}'`;
        }

        return definition;
    }

    private generateForeignKeyConstraints(nodes: Node[], warnings: string[]): string {
        let sql = '-- Foreign key constraints\n\n';
        let hasConstraints = false;

        for (const edge of this.edges) {
            const sourceNode = nodes.find(node => node.id === edge.source);
            const targetNode = nodes.find(node => node.id === edge.target);

            if (!sourceNode || !targetNode) continue;

            const sourceColumn = sourceNode.data.columns?.find((col: Column) => col.id === edge.sourceHandle);
            const targetColumn = targetNode.data.columns?.find((col: Column) => col.id === edge.targetHandle);

            if (!sourceColumn || !targetColumn) {
                warnings.push(`Invalid foreign key relationship between ${sourceNode.data.label} and ${targetNode.data.label}`);
                continue;
            }

            const constraintName = `fk_${sourceNode.data.label}_${sourceColumn.name}_to_${targetNode.data.label}_${targetColumn.name}`;

            sql += `ALTER TABLE \`${sourceNode.data.label}\`\n`;
            sql += `  ADD CONSTRAINT \`${constraintName}\`\n`;
            sql += `  FOREIGN KEY (\`${sourceColumn.name}\`) REFERENCES \`${targetNode.data.label}\`(\`${targetColumn.name}\`)`;

            // Add ON DELETE and ON UPDATE actions (default to RESTRICT)
            sql += ' ON DELETE RESTRICT ON UPDATE RESTRICT';

            sql += ';\n\n';
            hasConstraints = true;
        }

        return hasConstraints ? sql : '';
    }

    private generateIndexes(nodes: Node[], warnings: string[]): string {
        let sql = '-- Indexes\n\n';
        let hasIndexes = false;

        for (const node of nodes) {
            const tableName = node.data.label;
            const indexes = node.data.indexes || [];

            for (const index of indexes) {
                if (!index.columns || index.columns.length === 0) {
                    warnings.push(`Index ${index.name} on table ${tableName} has no columns`);
                    continue;
                }

                // Get column names
                const columnNames = index.columns
                    .map((colId: string) => {
                        const column = node.data.columns?.find((col: Column) => col.id === colId);
                        return column ? column.name : null;
                    })
                    .filter((name: string | null): name is string => Boolean(name));

                if (columnNames.length === 0) {
                    warnings.push(`Index ${index.name} on table ${tableName} references non-existent columns`);
                    continue;
                }

                sql += `CREATE`;

                if (index.type === 'UNIQUE') {
                    sql += ' UNIQUE';
                } else if (index.type === 'FULLTEXT') {
                    sql += ' FULLTEXT';
                } else if (index.type === 'SPATIAL') {
                    sql += ' SPATIAL';
                }

                sql += ` INDEX \`${index.name}\` ON \`${tableName}\` (`;
                sql += columnNames.map((name: string) => `\`${name}\``).join(', ');
                sql += ')';

                if (index.comment && this.options.includeComments) {
                    sql += ` COMMENT '${this.escapeString(index.comment)}'`;
                }

                sql += ';\n\n';
                hasIndexes = true;
            }

            // Also generate indexes for indexed columns that don't have explicit indexes
            const indexedColumns = node.data.columns?.filter((col: Column) => col.isIndexed && !col.isPrimaryKey) || [];
            for (const column of indexedColumns) {
                // Check if there's already an explicit index for this column
                const hasExplicitIndex = indexes.some((index: TableIndex) => index.columns.includes(column.id));
                if (!hasExplicitIndex) {
                    sql += `CREATE INDEX \`idx_${tableName}_${column.name}\` ON \`${tableName}\`(\`${column.name}\`);\n\n`;
                    hasIndexes = true;
                }
            }
        }

        return hasIndexes ? sql : '';
    }

    private isValidIdentifier(name: string): boolean {
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
    }

    private escapeString(str: string): string {
        return str.replace(/'/g, "''");
    }

    private normalizeDataType(type: string, columnName: string, warnings: string[]): string {
        if (!type || type === 'unknown') {
            // Smart type detection based on column name patterns
            const detectedType = this.detectDataTypeFromColumnName(columnName);
            if (detectedType) {
                warnings.push(`Unknown data type for '${columnName}' replaced with ${detectedType}`);
                return detectedType;
            }
            warnings.push(`Unknown data type replaced with TEXT`);
            return 'TEXT';
        }

        const upperType = type.toUpperCase().trim();

        // Handle VARCHAR without length - add default length
        if (upperType === 'VARCHAR') {
            return 'VARCHAR(255)';
        }

        // Handle VARCHAR with parameters
        if (upperType.startsWith('VARCHAR') && !upperType.includes('(')) {
            return 'VARCHAR(255)';
        }

        // Special handling for common timestamp column names
        if (columnName && (
            columnName.toLowerCase().includes('created_at') ||
            columnName.toLowerCase().includes('updated_at') ||
            columnName.toLowerCase().includes('deleted_at') ||
            columnName.toLowerCase().includes('timestamp') ||
            columnName.toLowerCase().includes('date') ||
            columnName.toLowerCase().includes('time')
        )) {
            if (upperType === 'UNKNOWN' || upperType === 'TEXT') {
                return 'TIMESTAMP';
            }
        }

        // Map common types to MySQL equivalents (comprehensive list from Common SQL Data Types.txt)
        const typeMap: { [key: string]: string } = {
            // Numeric Data Types
            'TINYINT': 'TINYINT',
            'SMALLINT': 'SMALLINT',
            'MEDIUMINT': 'MEDIUMINT',
            'INT': 'INT',
            'INTEGER': 'INT',
            'BIGINT': 'BIGINT',
            'DECIMAL': 'DECIMAL(10,2)',
            'NUMERIC': 'DECIMAL(10,2)',
            'FLOAT': 'FLOAT',
            'DOUBLE': 'DOUBLE',
            'REAL': 'DOUBLE',
            'BIT': 'BIT',
            'BOOLEAN': 'BOOLEAN',
            'BOOL': 'BOOLEAN',
            'SERIAL': 'BIGINT AUTO_INCREMENT',

            // String / Character Data Types
            'CHAR': 'CHAR(1)',
            'VARCHAR': 'VARCHAR(255)',
            'TINYTEXT': 'TINYTEXT',
            'TEXT': 'TEXT',
            'MEDIUMTEXT': 'MEDIUMTEXT',
            'LONGTEXT': 'LONGTEXT',
            'NCHAR': 'NCHAR(1)',
            'NVARCHAR': 'NVARCHAR(255)',
            'ENUM': 'ENUM',
            'SET': 'SET',
            'JSON': 'JSON',

            // Date & Time Data Types
            'DATE': 'DATE',
            'TIME': 'TIME',
            'DATETIME': 'DATETIME',
            'TIMESTAMP': 'TIMESTAMP',
            'YEAR': 'YEAR',

            // Binary / Large Object Types
            'BINARY': 'BINARY(255)',
            'VARBINARY': 'VARBINARY(255)',
            'TINYBLOB': 'TINYBLOB',
            'BLOB': 'BLOB',
            'MEDIUMBLOB': 'MEDIUMBLOB',
            'LONGBLOB': 'LONGBLOB',

            // Spatial / Geometry Data Types
            'GEOMETRY': 'GEOMETRY',
            'POINT': 'POINT',
            'LINESTRING': 'LINESTRING',
            'POLYGON': 'POLYGON',
            'MULTIPOINT': 'MULTIPOINT',
            'MULTILINESTRING': 'MULTILINESTRING',
            'MULTIPOLYGON': 'MULTIPOLYGON',
            'GEOMETRYCOLLECTION': 'GEOMETRYCOLLECTION',

            // Other / Special Types
            'UUID': 'CHAR(36)',
            'INET': 'VARCHAR(45)',
            'XML': 'TEXT'
        };

        // Check exact matches first
        if (typeMap[upperType]) {
            return typeMap[upperType];
        }

        // Handle parameterized types (with parentheses)
        if (upperType.includes('(')) {
            // Extract base type before parameters
            const baseType = upperType.split('(')[0];
            if (typeMap[baseType]) {
                // For types that should have parameters, keep the original
                if (['VARCHAR', 'CHAR', 'DECIMAL', 'NUMERIC', 'BINARY', 'VARBINARY', 'NCHAR', 'NVARCHAR'].includes(baseType)) {
                    return upperType;
                }
                // For other types, use the mapped version
                return typeMap[baseType];
            }
        }

        // Handle VARCHAR without length - add default length
        if (upperType === 'VARCHAR') {
            return 'VARCHAR(255)';
        }

        // Handle VARCHAR with parameters
        if (upperType.startsWith('VARCHAR') && !upperType.includes('(')) {
            return 'VARCHAR(255)';
        }

        // Handle CHAR with length
        if (upperType.startsWith('CHAR(')) {
            return upperType;
        }

        // Handle CHAR without length - add default length
        if (upperType === 'CHAR') {
            return 'CHAR(1)';
        }

        // Handle DECIMAL with precision
        if (upperType.startsWith('DECIMAL(')) {
            return upperType;
        }

        // Handle NUMERIC with precision
        if (upperType.startsWith('NUMERIC(')) {
            return upperType;
        }

        // Handle BINARY/VARBINARY with length
        if (upperType.startsWith('BINARY(') || upperType.startsWith('VARBINARY(')) {
            return upperType;
        }

        // Handle ENUM and SET with values
        if (upperType.startsWith('ENUM(') || upperType.startsWith('SET(')) {
            return upperType;
        }

        // Handle spatial types with parameters
        if (upperType.startsWith('GEOMETRY(') || upperType.startsWith('POINT(') ||
            upperType.startsWith('LINESTRING(') || upperType.startsWith('POLYGON(')) {
            return upperType;
        }

        // If type is not recognized, try smart detection
        const detectedType = this.detectDataTypeFromColumnName(columnName);
        if (detectedType) {
            warnings.push(`Unrecognized data type '${type}' for '${columnName}' replaced with ${detectedType}`);
            return detectedType;
        }

        // If type is not recognized, default to TEXT and warn
        warnings.push(`Unrecognized data type '${type}' replaced with TEXT`);
        return 'TEXT';
    }

    private detectDataTypeFromColumnName(columnName: string): string | null {
        if (!columnName) return null;

        const name = columnName.toLowerCase();

        // Timestamp/Date patterns
        if (name.includes('created_at') || name.includes('updated_at') || name.includes('deleted_at')) {
            return 'TIMESTAMP';
        }
        if (name.includes('timestamp') || name.includes('datetime')) {
            return 'TIMESTAMP';
        }
        if (name.includes('date') && !name.includes('rate')) {
            return 'DATE';
        }
        if (name.includes('time') && !name.includes('estimated') && !name.includes('duration')) {
            return 'TIME';
        }

        // Numeric patterns
        if (name.includes('id') || name.includes('_id') || name.includes('number')) {
            return 'INT';
        }
        if (name.includes('count') || name.includes('total') || name.includes('quantity')) {
            return 'INT';
        }
        if (name.includes('price') || name.includes('amount') || name.includes('cost') || name.includes('rate')) {
            return 'DECIMAL(10,2)';
        }
        if (name.includes('percentage') || name.includes('percent')) {
            return 'INT';
        }
        if (name.includes('duration') || name.includes('estimated_time') || name.includes('time_spent')) {
            return 'INT';
        }
        if (name.includes('order') || name.includes('position') || name.includes('index')) {
            return 'INT';
        }
        if (name.includes('rating') || name.includes('score') || name.includes('votes')) {
            return 'INT';
        }
        if (name.includes('size') || name.includes('length') || name.includes('file_size')) {
            return 'INT';
        }

        // Boolean patterns
        if (name.includes('is_') || name.includes('has_') || name.includes('can_')) {
            return 'BOOLEAN';
        }
        if (name.includes('active') || name.includes('enabled') || name.includes('published')) {
            return 'BOOLEAN';
        }
        if (name.includes('required') || name.includes('completed') || name.includes('resolved')) {
            return 'BOOLEAN';
        }
        if (name.includes('free') || name.includes('processing') || name.includes('bookmarked')) {
            return 'BOOLEAN';
        }
        if (name.includes('anonymous') || name.includes('pinned') || name.includes('external')) {
            return 'BOOLEAN';
        }

        // Text patterns
        if (name.includes('url') || name.includes('link') || name.includes('href')) {
            return 'VARCHAR(255)';
        }
        if (name.includes('email') || name.includes('mail')) {
            return 'VARCHAR(255)';
        }
        if (name.includes('phone') || name.includes('tel') || name.includes('mobile')) {
            return 'VARCHAR(20)';
        }
        if (name.includes('password') || name.includes('pass') || name.includes('token')) {
            return 'VARCHAR(255)';
        }
        if (name.includes('name') || name.includes('title') || name.includes('label')) {
            return 'VARCHAR(255)';
        }
        if (name.includes('description') || name.includes('content') || name.includes('body')) {
            return 'TEXT';
        }
        if (name.includes('comment') || name.includes('note') || name.includes('feedback')) {
            return 'TEXT';
        }
        if (name.includes('bio') || name.includes('about') || name.includes('summary')) {
            return 'TEXT';
        }
        if (name.includes('objectives') || name.includes('prerequisites') || name.includes('tags')) {
            return 'TEXT';
        }
        if (name.includes('meta') || name.includes('settings') || name.includes('config')) {
            return 'JSON';
        }
        if (name.includes('image') || name.includes('photo') || name.includes('avatar')) {
            return 'VARCHAR(255)';
        }
        if (name.includes('file') || name.includes('path') || name.includes('directory')) {
            return 'VARCHAR(255)';
        }
        if (name.includes('type') || name.includes('status') || name.includes('role')) {
            return 'VARCHAR(50)';
        }
        if (name.includes('level') || name.includes('difficulty') || name.includes('grade')) {
            return 'VARCHAR(50)';
        }
        if (name.includes('language') || name.includes('locale') || name.includes('lang')) {
            return 'VARCHAR(10)';
        }
        if (name.includes('currency') || name.includes('symbol')) {
            return 'VARCHAR(10)';
        }
        if (name.includes('method') || name.includes('payment') || name.includes('transaction')) {
            return 'VARCHAR(50)';
        }
        if (name.includes('code') || name.includes('key') || name.includes('hash')) {
            return 'VARCHAR(255)';
        }
        if (name.includes('address') || name.includes('location') || name.includes('street')) {
            return 'VARCHAR(255)';
        }
        if (name.includes('city') || name.includes('state') || name.includes('country')) {
            return 'VARCHAR(100)';
        }
        if (name.includes('zip') || name.includes('postal') || name.includes('postcode')) {
            return 'VARCHAR(20)';
        }
        if (name.includes('whatsapp') || name.includes('telegram') || name.includes('skype')) {
            return 'VARCHAR(50)';
        }
        if (name.includes('facebook') || name.includes('twitter') || name.includes('instagram')) {
            return 'VARCHAR(255)';
        }
        if (name.includes('linkedin') || name.includes('github') || name.includes('website')) {
            return 'VARCHAR(255)';
        }

        return null;
    }

    private isNumericType(type: string): boolean {
        const upperType = type.toUpperCase();
        return [
            'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
            'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'BOOL'
        ].some(numericType => upperType.includes(numericType));
    }
}

export function generateSQL(nodes: Node[], edges: Edge[], options: SQLOptions = {}): SQLGenerationResult {
    const generator = new SQLGenerator(nodes, edges, options);
    return generator.generate();
}
