import { parse } from "sql-parser-cst";
import { TableNodeData, Column, TableIndex } from "@/components/editor/nodes/table-node";

function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

export interface SQLParseResult {
    tables: TableNodeData[];
    foreignKeyConstraints: Array<{
        tableName: string;
        columnName: string;
        referencedTable: string;
        referencedColumn: string;
        onDelete?: string;
        onUpdate?: string;
        cardinality?: '1:1' | '1:N' | 'N:M';
    }>;
    errors: string[];
    warnings: string[];
}

export function parseSqlToTables(sql: string): TableNodeData[] {
    const result = parseSQLFile(sql);
    return result.tables;
}

function splitByCommaOutsideParens(str: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '(') depth++;
        else if (char === ')') depth--;

        if (char === ',' && depth === 0) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result.filter(s => s !== '');
}

interface AlterTableConstraints {
    foreignKeys: Array<{
        tableName: string;
        columnName: string;
        referencedTable: string;
        referencedColumn: string;
        onDelete?: string;
        onUpdate?: string;
        cardinality?: '1:1' | '1:N' | 'N:M';
    }>;
    primaryKeys: Array<{
        tableName: string;
        columnNames: string[];
    }>;
    uniqueKeys: Array<{
        tableName: string;
        columnNames: string[];
    }>;
    autoIncrements: Array<{
        tableName: string;
        columnName: string;
    }>;
}

function extractConstraintsFromAlterTable(sql: string): AlterTableConstraints {
    const results: AlterTableConstraints = {
        foreignKeys: [],
        primaryKeys: [],
        uniqueKeys: [],
        autoIncrements: []
    };

    // Remove comments for easier matching
    let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, '');
    cleaned = cleaned.replace(/^--.*$/gm, '');
    cleaned = cleaned.replace(/^#.*$/gm, '');

    // Match each ALTER TABLE statement
    // Handles backticks, double quotes, or no quotes for table names
    const alterTableRegex = /ALTER\s+TABLE\s+(?:[`"']?)([^`"'\s]+)(?:[`"']?)\s+([\s\S]+?);/gi;
    let match;

    while ((match = alterTableRegex.exec(cleaned)) !== null) {
        const tableName = match[1];
        const body = match[2];

        // Split body by commas not inside parentheses to handle multiple ADD/MODIFY clauses
        const segments = splitByCommaOutsideParens(body);

        for (let segment of segments) {
            segment = segment.trim();
            const upperSegment = segment.toUpperCase();

            // 1. Primary Keys
            // Handles ADD PRIMARY KEY (`id`) or ADD PRIMARY KEY (id)
            if (upperSegment.includes('ADD PRIMARY KEY')) {
                const pkMatch = segment.match(/ADD\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i);
                if (pkMatch) {
                    const columnNames = pkMatch[1].split(',').map(c => c.trim().replace(/[`"']/g, ''));
                    results.primaryKeys.push({ tableName, columnNames });
                }
            }
            // 2. Foreign Keys
            // Handles ADD CONSTRAINT `fk_name` FOREIGN KEY (`col`) REFERENCES `ref_table` (`ref_col`)
            // Also handles versions without CONSTRAINT name or without backticks
            else if (upperSegment.includes('FOREIGN KEY')) {
                const fkRegex = /(?:ADD\s+)?(?:CONSTRAINT\s+(?:[`"']?)[^`"'\s]*(?:[`"']?)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:[`"']?)([^`"'\s]+)(?:[`"']?)\s*\(([^)]+)\)(?:\s+ON\s+(DELETE|UPDATE)\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION|SET\s+DEFAULT))?/gi;
                let fkMatch;
                // Reset regex lastIndex because we are using 'g' flag
                fkRegex.lastIndex = 0;
                while ((fkMatch = fkRegex.exec(segment)) !== null) {
                    const columnNames = fkMatch[1].split(',').map(c => c.trim().replace(/[`"']/g, ''));
                    const referencedTable = fkMatch[2];
                    const referencedColumns = fkMatch[3].split(',').map(c => c.trim().replace(/[`"']/g, ''));
                    const actionType = fkMatch[4];
                    const actionValue = fkMatch[5];

                    // For now, we only support single column foreign keys in the UI/Store, 
                    // but we collect them all. We'll add the first column if it's a composite key.
                    columnNames.forEach((columnName, index) => {
                        const referencedColumn = referencedColumns[index] || referencedColumns[0];
                        results.foreignKeys.push({
                            tableName,
                            columnName,
                            referencedTable,
                            referencedColumn,
                            ...(actionType && actionValue && {
                                [actionType.toLowerCase() === 'delete' ? 'onDelete' : 'onUpdate']: actionValue.replace(/\s+/g, ' ')
                            })
                        });
                    });
                }
            }
            // 3. Unique Keys
            // Handles ADD UNIQUE KEY `name` (`col`) or ADD UNIQUE (`col`)
            else if (upperSegment.includes('ADD UNIQUE')) {
                const uniqueMatch = segment.match(/ADD\s+UNIQUE\s+(?:KEY|INDEX)?\s*(?:(?:[`"']?)[^`"'\s]*(?:[`"']?)\s+)?\(([^)]+)\)/i);
                if (uniqueMatch) {
                    const columnNames = uniqueMatch[1].split(',').map(c => c.trim().replace(/[`"']/g, ''));
                    results.uniqueKeys.push({ tableName, columnNames });
                }
            }
            // 4. Auto Increment
            // Handles MODIFY `id` INT AUTO_INCREMENT
            else if (upperSegment.includes('AUTO_INCREMENT')) {
                const aiMatch = segment.match(/(?:MODIFY|CHANGE|ALTER)\s+(?:[`"']?)([^`"'\s]+)(?:[`"']?)/i);
                if (aiMatch) {
                    results.autoIncrements.push({ tableName, columnName: aiMatch[1] });
                }
            }
        }
    }

    return results;
}

function preprocessSQL(sql: string): string {
    // 1. Remove all comments first
    // Multiline and MySQL executable comments /*! ... */
    let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, '');
    // Standard single line comments
    cleaned = cleaned.replace(/^--.*$/gm, '');
    cleaned = cleaned.replace(/^#.*$/gm, '');
    // Inline comments with space before
    cleaned = cleaned.replace(/[ \t]--.*$/gm, '');

    // 2. Split into individual statements by semicolon
    const statements = cleaned.split(';');
    const output: string[] = [];

    for (let rawStmt of statements) {
        let stmt = rawStmt.trim();
        if (!stmt) continue;

        const upper = stmt.toUpperCase();

        // Skip non-essential MySQL directives
        if (upper.startsWith('SET ') ||
            upper.startsWith('START TRANSACTION') ||
            upper.startsWith('COMMIT') ||
            upper.startsWith('ROLLBACK') ||
            upper.startsWith('LOCK TABLES') ||
            upper.startsWith('UNLOCK TABLES') ||
            upper.startsWith('INSERT INTO') ||
            upper.startsWith('REPLACE INTO')) {
            continue;
        }

        if (upper.startsWith('CREATE TABLE')) {
            // Remove MySQL table options after the last closing parenthesis (ENGINE, CHARSET, etc.)
            const lastParenIndex = stmt.lastIndexOf(')');
            if (lastParenIndex !== -1) {
                stmt = stmt.substring(0, lastParenIndex + 1);
            }

            // Remove MySQL-specific column noise
            stmt = stmt.replace(/CHARACTER\s+SET\s+\w+/gi, '');
            stmt = stmt.replace(/COLLATE\s+\w+/gi, '');
            stmt = stmt.replace(/COMMENT\s+'[^']*'/gi, '');
            stmt = stmt.replace(/COMMENT\s+"[^"]*"/gi, '');
            stmt = stmt.replace(/\bUNSIGNED\b/gi, '');
            stmt = stmt.replace(/\bZEROFILL\b/gi, '');
            // Improved regex to handle nested parentheses in GENERATED ALWAYS AS clauses
            // This handles up to 2 levels of nesting, which covers common SQL expressions
            stmt = stmt.replace(/GENERATED\s+ALWAYS\s+AS\s*\((?:[^()]+|\((?:[^()]+|\([^()]*\))*\))*\)\s*(?:STORED|VIRTUAL)?/gi, '');

            // Fix function calls that might not be supported
            stmt = stmt.replace(/current_timestamp\(\)/gi, 'CURRENT_TIMESTAMP');

            // Keep backticks for MySQL dialect support, or unquote for others
            // Let's keep them for now as the parser handles MySQL dialect
            output.push(stmt + ';');
        } else if (upper.startsWith('ALTER TABLE')) {
            // Skip ALTER TABLE statements for the CST parser as we handle them separately via regex.
            // This prevents syntax errors from non-standard or MySQL-specific ALTER syntax.
            continue;
        }
    }

    // Join back with spacing
    return output.join('\n\n');
}

export function parseSQLFile(sql: string): SQLParseResult {
    const result: SQLParseResult = {
        tables: [],
        foreignKeyConstraints: [],
        errors: [],
        warnings: []
    };

    // Extract constraints from ALTER TABLE statements first using regex
    const alterTableConstraints = extractConstraintsFromAlterTable(sql);
    result.foreignKeyConstraints.push(...alterTableConstraints.foreignKeys);

    // Preprocess the SQL to handle various file formats
    const processedSQL = preprocessSQL(sql);

    // Try different SQL dialects
    let cst;
    const dialects = ['postgresql', 'mysql', 'sqlite'] as const;

    for (const dialect of dialects) {
        try {
            cst = parse(processedSQL, { dialect });
            break;
        } catch (e) {
            if (dialect === dialects[dialects.length - 1]) {
                // Last dialect failed, record the error and try to provide helpful feedback
                const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                result.errors.push(`SQL Parse Error: ${errorMessage}`);

                // Add helpful suggestions based on common errors
                if (errorMessage.includes('ENGINE')) {
                    result.errors.push('Tip: Remove MySQL-specific ENGINE= clauses for better compatibility');
                } else if (errorMessage.includes('UUID') || errorMessage.includes('gen_random_uuid')) {
                    result.errors.push('Tip: Replace UUID types and gen_random_uuid() with standard types');
                } else if (errorMessage.includes('ENUM')) {
                    result.errors.push('Tip: Replace ENUM types with VARCHAR for better compatibility');
                } else if (errorMessage.includes('INDEX')) {
                    result.errors.push('Tip: Remove INDEX definitions inside CREATE TABLE statements');
                } else if (errorMessage.includes('`')) {
                    result.errors.push('Tip: Remove backtick-quoted identifiers or convert to standard quotes');
                } else {
                    result.errors.push('Tip: Ensure your SQL file contains valid CREATE TABLE statements');
                    result.errors.push('Tip: Try removing MySQL-specific directives and comments');
                }

                return result;
            }
        }
    }

    // Traverse basic CST structure
    const root = cst as any;

    if (root.type === "program" && Array.isArray(root.statements)) {
        for (const stmt of root.statements) {
            if (stmt.type === "create_table_stmt") {
                try {
                    const tableResult = parseCreateTableStatement(stmt);
                    if (tableResult.table) {
                        // Add foreign keys from inline definitions
                        result.foreignKeyConstraints.push(...tableResult.foreignKeys);
                        result.tables.push(tableResult.table);
                        result.warnings.push(...tableResult.warnings);
                    }
                } catch (e) {
                    result.errors.push(`Error parsing table: ${e instanceof Error ? e.message : 'Unknown error'}`);
                }
            }
        }
    }

    // Apply primary keys from ALTER TABLE statements
    for (const pk of alterTableConstraints.primaryKeys) {
        const table = result.tables.find(t => t.label === pk.tableName);
        if (table) {
            // Reset any implicitly detected primary keys first
            table.columns.forEach(c => c.isPrimaryKey = false);

            pk.columnNames.forEach(colName => {
                const column = table.columns.find(c => c.name === colName);
                if (column) {
                    column.isPrimaryKey = true;
                    column.isNullable = false;
                }
            });
        }
    }

    // Apply unique constraints from ALTER TABLE statements
    for (const uk of alterTableConstraints.uniqueKeys) {
        const table = result.tables.find(t => t.label === uk.tableName);
        if (table) {
            uk.columnNames.forEach(colName => {
                const column = table.columns.find(c => c.name === colName);
                if (column) {
                    column.isUnique = true;
                }
            });
        }
    }

    // Apply auto-increment from ALTER TABLE statements
    for (const ai of alterTableConstraints.autoIncrements) {
        const table = result.tables.find(t => t.label === ai.tableName);
        if (table) {
            const column = table.columns.find(c => c.name === ai.columnName);
            if (column) {
                column.autoIncrement = true;
            }
        }
    }

    // Apply foreign keys from ALTER TABLE statements to the parsed tables
    for (const fk of alterTableConstraints.foreignKeys) {
        const table = result.tables.find(t => t.label === fk.tableName);
        if (table) {
            const column = table.columns.find(c => c.name === fk.columnName);
            if (column) {
                column.isForeignKey = true;
                column.referencedTable = fk.referencedTable;
                column.referencedColumn = fk.referencedColumn;
            } else {
                result.warnings.push(`Foreign key column "${fk.columnName}" not found in table "${fk.tableName}"`);
            }
        } else {
            result.warnings.push(`Table "${fk.tableName}" referenced in foreign key not found in CREATE TABLE statements`);
        }
    }

    return result;
}

function detectImplicitPrimaryKey(tableName: string, columns: Column[]): Column | null {
    // If no explicit primary key found, try to detect implicit primary key based on naming conventions
    if (columns.length === 0) return null;

    // Check for junction table patterns (tables that typically have composite primary keys)
    const junctionTablePatterns = [
        /.*ables$/,  // ends with "ables" (like branchables)
        /.*ings$/,   // ends with "ings" (like class_students, course_enrollments)
        /.*_has_/,  // contains "_has_" (like user_has_roles)
        /.*_to_/,   // contains "_to_" (like user_to_role)
    ];

    const isJunctionTable = junctionTablePatterns.some(pattern => pattern.test(tableName.toLowerCase()));

    if (isJunctionTable && columns.length >= 2) {
        // For junction tables, look for foreign key columns that could form a composite key
        const fkColumns = columns.filter(col => col.isForeignKey);
        if (fkColumns.length >= 2) {
            // Use the first foreign key as the primary key for display purposes
            // In a real database, this would be a composite key, but we need to pick one for visualization
            return fkColumns[0];
        }
    }

    // Common primary key naming patterns
    const pkPatterns = [
        `${tableName}_id`,  // table_name_id
        `${tableName.slice(0, -1)}_id`,  // table_name_id (for plural table names)
        'id',  // generic id
        'uuid',  // generic uuid
        'guid',  // generic guid
    ];

    // First, try exact matches
    for (const pattern of pkPatterns) {
        const candidate = columns.find(col =>
            col.name.toLowerCase() === pattern.toLowerCase()
        );
        if (candidate) {
            return candidate;
        }
    }

    // Try partial matches (for cases like user_id in users table)
    for (const pattern of pkPatterns) {
        const candidate = columns.find(col =>
            col.name.toLowerCase().includes(pattern.toLowerCase())
        );
        if (candidate) {
            return candidate;
        }
    }

    // If still no match, pick the first column that's NOT a foreign key
    const nonFkColumn = columns.find(col => !col.isForeignKey);
    if (nonFkColumn) {
        return nonFkColumn;
    }

    // Last resort: return the first column
    return columns[0];
}

function parseCreateTableStatement(stmt: any): {
    table?: TableNodeData;
    foreignKeys: Array<{
        tableName: string;
        columnName: string;
        referencedTable: string;
        referencedColumn: string;
        onDelete?: string;
        onUpdate?: string;
        cardinality?: '1:1' | '1:N' | 'N:M';
    }>;
    warnings: string[];
} {
    const tableName = stmt.name?.name;
    if (!tableName) {
        throw new Error('Table name not found');
    }

    const columns: Column[] = [];
    const foreignKeys: Array<{
        tableName: string;
        columnName: string;
        referencedTable: string;
        referencedColumn: string;
        onDelete?: string;
        onUpdate?: string;
        cardinality?: '1:1' | '1:N' | 'N:M';
    }> = [];
    const warnings: string[] = [];
    const indexes: TableIndex[] = [];

    // Parse column definitions
    if (stmt.columns && stmt.columns.expr && stmt.columns.expr.items) {
        for (const item of stmt.columns.expr.items) {
            if (item.type === "column_definition") {
                const columnResult = parseColumnDefinition(item);
                if (columnResult.column) {
                    columns.push(columnResult.column);
                    warnings.push(...columnResult.warnings);
                }

                if (columnResult.foreignKey) {
                    foreignKeys.push({
                        tableName,
                        ...columnResult.foreignKey
                    });
                }
            }
        }
    }

    // Parse out-of-line constraints (FOREIGN KEY, PRIMARY KEY, UNIQUE, etc.)
    let hasExplicitPrimaryKey = false;
    if (stmt.constraints && stmt.constraints.expr && stmt.constraints.expr.items) {
        for (const constraint of stmt.constraints.expr.items) {
            if (constraint.type === "table_constraint") {
                const constraintResult = parseTableConstraint(constraint, tableName);
                foreignKeys.push(...constraintResult.foreignKeys);
                warnings.push(...constraintResult.warnings);

                // Handle multi-column primary keys
                if (constraintResult.primaryKeyColumns && constraintResult.primaryKeyColumns.length > 0) {
                    hasExplicitPrimaryKey = true;
                    constraintResult.primaryKeyColumns.forEach(colName => {
                        const column = columns.find(c => c.name === colName);
                        if (column) {
                            column.isPrimaryKey = true;
                            column.isNullable = false;
                        } else {
                            warnings.push(`Primary key column "${colName}" not found in table "${tableName}"`);
                        }
                    });
                }

                // Handle unique constraints
                if (constraintResult.uniqueColumns && constraintResult.uniqueColumns.length > 0) {
                    constraintResult.uniqueColumns.forEach(colName => {
                        const column = columns.find(c => c.name === colName);
                        if (column) {
                            column.isUnique = true;
                        }
                    });

                    // Create index for unique constraint
                    if (constraintResult.constraintName) {
                        indexes.push({
                            id: generateId(),
                            name: constraintResult.constraintName,
                            columns: constraintResult.uniqueColumns.map(colName => {
                                const column = columns.find(c => c.name === colName);
                                return column?.id || '';
                            }).filter(Boolean),
                            type: 'UNIQUE'
                        });
                    }
                }
            }
        }
    }

    // If no explicit primary key found, try to detect implicit primary key
    if (!hasExplicitPrimaryKey && columns.length > 0) {
        const implicitPk = detectImplicitPrimaryKey(tableName, columns);
        if (implicitPk) {
            implicitPk.isPrimaryKey = true;
            implicitPk.isNullable = false;
            // This is informational, not a warning - the detection worked correctly
            // warnings.push(`Detected implicit primary key: "${implicitPk.name}" in table "${tableName}"`);
        } else {
            warnings.push(`Table "${tableName}" has no detectable primary key`);
        }
    }

    // Extract table-level properties
    let engine: 'InnoDB' | 'MyISAM' | 'MEMORY' | 'ARCHIVE' | 'CSV' = 'InnoDB';
    let collation: string | undefined;
    let comment: string | undefined;

    if (stmt.options) {
        for (const option of stmt.options) {
            if (option.type === "table_option") {
                if (option.name?.text?.toUpperCase() === 'ENGINE') {
                    engine = mapEngineType(option.value?.text);
                } else if (option.name?.text?.toUpperCase() === 'COLLATE') {
                    collation = option.value?.text;
                } else if (option.name?.text?.toUpperCase() === 'COMMENT') {
                    comment = option.value?.text?.replace(/['"]/g, '');
                }
            }
        }
    }

    // Final pass for relationships to determine cardinality
    foreignKeys.forEach(fk => {
        const sourceCol = columns.find(c => c.name === fk.columnName);
        if (sourceCol && (sourceCol.isUnique || sourceCol.isPrimaryKey)) {
            fk.cardinality = '1:1';
        } else {
            fk.cardinality = '1:N';
        }
    });

    const table: TableNodeData = {
        label: tableName,
        columns,
        engine,
        collation,
        comment,
        indexes: indexes.length > 0 ? indexes : undefined
    };

    return { table, foreignKeys, warnings };
}

function parseColumnDefinition(item: any): {
    column?: Column;
    foreignKey?: {
        columnName: string;
        referencedTable: string;
        referencedColumn: string;
        onDelete?: string;
        onUpdate?: string;
    };
    warnings: string[];
} {
    const warnings: string[] = [];

    const colName = item.name?.name;
    if (!colName) {
        warnings.push('Column name not found');
        return { warnings };
    }

    const dataType = getDataTypeString(item.dataType);

    let isPrimaryKey = false;
    let isNullable = true;
    let isUnique = false;
    let isForeignKey = false;
    let defaultValue: string | undefined;
    let autoIncrement = false;
    let collation: string | undefined;
    let comment: string | undefined;

    // Parse column constraints
    if (item.constraints) {
        for (const constraint of item.constraints) {
            switch (constraint.type) {
                case "constraint_primary_key":
                    isPrimaryKey = true;
                    isNullable = false;
                    break;
                case "constraint_not_null":
                    isNullable = false;
                    break;
                case "constraint_null":
                    isNullable = true;
                    break;
                case "constraint_unique":
                    isUnique = true;
                    break;
                case "constraint_default":
                    defaultValue = getDefaultValue(constraint.value);
                    break;
                case "constraint_auto_increment":
                case "constraint_identity":
                    autoIncrement = true;
                    break;
                case "constraint_collate":
                    collation = constraint.collation?.name;
                    break;
                case "constraint_comment":
                    comment = constraint.text?.text?.replace(/['"]/g, '');
                    break;
                case "constraint_references":
                    isForeignKey = true;
                    const refTable = constraint.table?.name;
                    const refColumn = constraint.columns?.expr?.items?.[0]?.name;
                    if (refTable && refColumn) {
                        return {
                            column: {
                                id: generateId(),
                                name: colName,
                                type: processColumnType(colName, dataType),
                                isPrimaryKey,
                                isForeignKey,
                                isNullable,
                                isUnique,
                                defaultValue,
                                autoIncrement,
                                collation,
                                comment,
                                referencedTable: refTable,
                                referencedColumn: refColumn
                            },
                            foreignKey: {
                                columnName: colName,
                                referencedTable: refTable,
                                referencedColumn: refColumn,
                                onDelete: constraint.on_delete?.text,
                                onUpdate: constraint.on_update?.text
                            },
                            warnings
                        };
                    }
                    break;
            }
        }
    }

    if (isPrimaryKey) isNullable = false;

    return {
        column: {
            id: generateId(),
            name: colName,
            type: processColumnType(colName, dataType),
            isPrimaryKey,
            isForeignKey,
            isNullable,
            isUnique,
            defaultValue,
            autoIncrement,
            collation,
            comment
        },
        warnings
    };
}

function parseTableConstraint(constraint: any, tableName: string): {
    foreignKeys: Array<{
        tableName: string;
        columnName: string;
        referencedTable: string;
        referencedColumn: string;
        onDelete?: string;
        onUpdate?: string;
    }>;
    warnings: string[];
    primaryKeyColumns?: string[];
    uniqueColumns?: string[];
    constraintName?: string;
} {
    const foreignKeys: Array<{
        tableName: string;
        columnName: string;
        referencedTable: string;
        referencedColumn: string;
        onDelete?: string;
        onUpdate?: string;
    }> = [];
    const warnings: string[] = [];
    let primaryKeyColumns: string[] = [];
    let uniqueColumns: string[] = [];
    let constraintName: string | undefined;

    if (constraint.constraint_name?.name) {
        constraintName = constraint.constraint_name.name;
    }

    const constraintType = constraint.constraint_type;

    switch (constraintType?.type) {
        case "constraint_foreign_key":
            const fkConstraint = constraintType;
            const sourceColumns = fkConstraint.columns?.expr?.items?.map((item: any) => item.name) || [];
            const refTable = fkConstraint.reference?.table?.name;
            const refColumns = fkConstraint.reference?.columns?.expr?.items?.map((item: any) => item.name) || [];

            sourceColumns.forEach((sourceCol: string, index: number) => {
                const refCol = refColumns[index] || 'id';
                foreignKeys.push({
                    tableName,
                    columnName: sourceCol,
                    referencedTable: refTable,
                    referencedColumn: refCol,
                    onDelete: fkConstraint.reference?.on_delete?.text,
                    onUpdate: fkConstraint.reference?.on_update?.text
                });
            });
            break;

        case "constraint_primary_key":
            primaryKeyColumns = constraintType.columns?.expr?.items?.map((item: any) => item.name) || [];
            break;

        case "constraint_unique":
            uniqueColumns = constraintType.columns?.expr?.items?.map((item: any) => item.name) || [];
            break;

        default:
            warnings.push(`Unsupported constraint type: ${constraintType?.type}`);
    }

    return { foreignKeys, warnings, primaryKeyColumns, uniqueColumns, constraintName };
}

function getDataTypeString(dataTypeNode: any): string {
    if (!dataTypeNode) return "unknown";

    switch (dataTypeNode.type) {
        case "data_type_name":
            const typeName = dataTypeNode.name?.text?.toUpperCase() || "unknown";
            return normalizeDataTypeName(typeName);

        case "modified_data_type":
            const baseType = getDataTypeString(dataTypeNode.dataType);
            if (dataTypeNode.modifiers?.expr?.items) {
                const params = dataTypeNode.modifiers.expr.items.map((i: any) => {
                    if (i.text) return i.text;
                    if (i.value !== undefined) return i.value;
                    if (typeof i === 'string') return i;
                    return '';
                }).filter((s: string) => s !== '').join(",");
                return `${baseType}(${params})`;
            }
            return baseType;
        default:
            return "unknown";
    }
}

// Enhanced data type normalization with smart ID detection
function normalizeDataTypeName(typeName: string): string {
    const upperType = typeName.toUpperCase().trim();

    // String / Character Data Types
    const stringTypes = {
        'CHAR': 'CHAR',
        'VARCHAR': 'VARCHAR',
        'TEXT': 'TEXT',
        'TINYTEXT': 'TINYTEXT',
        'MEDIUMTEXT': 'MEDIUMTEXT',
        'LONGTEXT': 'LONGTEXT',
        'NCHAR': 'NCHAR',
        'NVARCHAR': 'NVARCHAR',
        'JSON': 'JSON'
    };

    // Numeric Data Types
    const numericTypes = {
        'TINYINT': 'TINYINT',
        'SMALLINT': 'SMALLINT',
        'MEDIUMINT': 'MEDIUMINT',
        'INT': 'INT',
        'INTEGER': 'INT',
        'BIGINT': 'BIGINT',
        'DECIMAL': 'DECIMAL',
        'NUMERIC': 'NUMERIC',
        'FLOAT': 'FLOAT',
        'DOUBLE': 'DOUBLE',
        'REAL': 'DOUBLE',
        'BIT': 'BIT',
        'BOOLEAN': 'BOOLEAN',
        'BOOL': 'BOOLEAN',
        'SERIAL': 'BIGINT'
    };

    // Date & Time Data Types
    const dateTypes = {
        'DATE': 'DATE',
        'TIME': 'TIME',
        'DATETIME': 'DATETIME',
        'TIMESTAMP': 'TIMESTAMP',
        'YEAR': 'YEAR'
    };

    // Binary / Large Object Types
    const binaryTypes = {
        'BINARY': 'BINARY',
        'VARBINARY': 'VARBINARY',
        'TINYBLOB': 'TINYBLOB',
        'BLOB': 'BLOB',
        'MEDIUMBLOB': 'MEDIUMBLOB',
        'LONGBLOB': 'LONGBLOB'
    };

    // Special Types
    const specialTypes = {
        'ENUM': 'ENUM',
        'SET': 'SET',
        'GEOMETRY': 'GEOMETRY',
        'POINT': 'POINT',
        'LINESTRING': 'LINESTRING',
        'POLYGON': 'POLYGON',
        'MULTIPOINT': 'MULTIPOINT',
        'MULTILINESTRING': 'MULTILINESTRING',
        'MULTIPOLYGON': 'MULTIPOLYGON',
        'GEOMETRYCOLLECTION': 'GEOMETRYCOLLECTION',
        'UUID': 'UUID', // Add UUID support
        'INET': 'VARCHAR',
        'XML': 'TEXT'
    };

    // Check all type categories
    const allTypes: { [key: string]: string } = { ...stringTypes, ...numericTypes, ...dateTypes, ...binaryTypes, ...specialTypes };

    if (allTypes[upperType]) {
        return allTypes[upperType];
    }

    // Fallback for unrecognized types
    return upperType.toLowerCase();
}

// Enhanced column processing with smart ID detection
function processColumnType(columnName: string, dataType: string): string {
    const upperColumnName = columnName.toUpperCase();
    const upperDataType = dataType.toUpperCase();

    // First, handle UNSIGNED types by removing the keyword and processing the base type
    let cleanDataType = upperDataType.replace(/\s+UNSIGNED/g, '');

    // Smart ID detection: Convert CHAR(36) or specific string patterns to proper UUID type
    if (cleanDataType === 'CHAR(36)' || cleanDataType === 'UUID') {
        return 'UUID';
    }

    // Check if it's a UUID pattern in a string field
    if (cleanDataType.startsWith('VARCHAR') || cleanDataType.startsWith('CHAR')) {
        if (upperColumnName.endsWith('_UUID') || (upperColumnName === 'ID' && cleanDataType === 'CHAR(36)')) {
            return 'UUID';
        }
    }

    // Handle ENUM types properly - preserve values
    if (cleanDataType.startsWith('ENUM')) {
        return cleanDataType;
    }

    // Handle date and time types properly
    if (cleanDataType.includes('TIMESTAMP')) {
        return 'TIMESTAMP';
    }
    if (cleanDataType.includes('DATETIME')) {
        return 'DATETIME';
    }
    if (cleanDataType === 'DATE') {
        return 'DATE';
    }
    if (cleanDataType === 'TIME') {
        return 'TIME';
    }
    if (cleanDataType === 'YEAR') {
        return 'YEAR';
    }

    // Handle text types
    if (cleanDataType.includes('TEXT')) {
        if (cleanDataType.includes('LONG')) return 'LONGTEXT';
        if (cleanDataType.includes('MEDIUM')) return 'MEDIUMTEXT';
        if (cleanDataType.includes('TINY')) return 'TINYTEXT';
        return 'TEXT';
    }

    // Handle JSON type
    if (cleanDataType === 'JSON') {
        return 'JSON';
    }

    // Handle numeric types
    if (cleanDataType.startsWith('BIGINT')) {
        return cleanDataType;
    }
    if (cleanDataType.startsWith('INT')) {
        return cleanDataType;
    }
    if (cleanDataType.startsWith('TINYINT')) {
        // Only convert tinyint(1) to BOOLEAN if it looks like a flag field
        if (cleanDataType.startsWith('TINYINT(1)') && (
            upperColumnName.startsWith('IS_') ||
            upperColumnName.startsWith('HAS_') ||
            upperColumnName.startsWith('CAN_') ||
            upperColumnName.includes('ACTIVE') ||
            upperColumnName.includes('ENABLED') ||
            upperColumnName.includes('PUBLISHED') ||
            upperColumnName.includes('COMPLETED')
        )) {
            return 'BOOLEAN';
        }
        return cleanDataType;
    }
    if (cleanDataType.startsWith('SMALLINT')) {
        return cleanDataType;
    }
    if (cleanDataType.startsWith('MEDIUMINT')) {
        return cleanDataType;
    }
    if (cleanDataType.startsWith('DECIMAL')) {
        return cleanDataType;
    }
    if (cleanDataType.startsWith('DOUBLE')) {
        return cleanDataType;
    }
    if (cleanDataType.startsWith('FLOAT')) {
        return cleanDataType;
    }
    if (cleanDataType.startsWith('BIT')) {
        return cleanDataType;
    }

    // Handle string types
    if (cleanDataType.startsWith('VARCHAR')) {
        return cleanDataType;
    }
    if (cleanDataType.startsWith('CHAR')) {
        return cleanDataType;
    }
    if (cleanDataType.startsWith('NCHAR')) {
        return cleanDataType;
    }
    if (cleanDataType.startsWith('NVARCHAR')) {
        return cleanDataType;
    }

    // Handle binary types
    if (cleanDataType.startsWith('BINARY') || cleanDataType.startsWith('BINARY(')) {
        return 'BINARY';
    }
    if (cleanDataType.startsWith('VARBINARY') || cleanDataType.startsWith('VARBINARY(')) {
        return 'VARBINARY';
    }
    if (cleanDataType.startsWith('TINYBLOB')) {
        return 'TINYBLOB';
    }
    if (cleanDataType.startsWith('BLOB')) {
        return 'BLOB';
    }
    if (cleanDataType.startsWith('MEDIUMBLOB')) {
        return 'MEDIUMBLOB';
    }
    if (cleanDataType.startsWith('LONGBLOB')) {
        return 'LONGBLOB';
    }

    // Handle special types
    if (cleanDataType === 'BOOLEAN' || cleanDataType === 'BOOL') {
        return 'BOOLEAN';
    }
    if (cleanDataType === 'SERIAL') {
        return 'BIGINT';
    }
    if (cleanDataType === 'UUID') {
        return 'UUID';
    }
    if (cleanDataType === 'INET') {
        return 'VARCHAR';
    }
    if (cleanDataType === 'XML') {
        return 'TEXT';
    }

    // Return the cleaned data type if no specific handling matched
    return cleanDataType;
}

function getDefaultValue(valueNode: any): string | undefined {
    if (!valueNode) return undefined;

    switch (valueNode.type) {
        case "literal_null":
            return "NULL";
        case "literal_string":
            return valueNode.text?.replace(/['"]/g, '');
        case "literal_number":
            return valueNode.text;
        case "function_call":
            if (valueNode.name?.text?.toUpperCase() === 'CURRENT_TIMESTAMP') {
                return "CURRENT_TIMESTAMP";
            }
            return valueNode.text;
        default:
            return valueNode.text;
    }
}

function mapEngineType(engineStr?: string): 'InnoDB' | 'MyISAM' | 'MEMORY' | 'ARCHIVE' | 'CSV' {
    if (!engineStr) return 'InnoDB';

    const engine = engineStr.toUpperCase();
    switch (engine) {
        case 'INNODB':
            return 'InnoDB';
        case 'MYISAM':
            return 'MyISAM';
        case 'MEMORY':
            return 'MEMORY';
        case 'ARCHIVE':
            return 'ARCHIVE';
        case 'CSV':
            return 'CSV';
        default:
            return 'InnoDB';
    }
}
