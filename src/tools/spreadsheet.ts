import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import ExcelJS from "exceljs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname } from "node:path";

const SpreadsheetActionSchema = z.object({
    action: z.enum(["create", "read", "add_sheet", "add_rows", "format"]).describe("Action to perform"),
    path: z.string().describe("File path for the spreadsheet (.xlsx)"),
    // For create
    sheetName: z.string().optional().default("Sheet1").describe("Sheet name"),
    columns: z.array(z.object({
        header: z.string(),
        key: z.string(),
        width: z.number().optional(),
    })).optional().describe("Column definitions for create"),
    rows: z.array(z.record(z.unknown())).optional().describe("Row data as array of objects"),
    // For read
    sheet: z.string().optional().describe("Sheet name to read (defaults to first sheet)"),
    // For format
    headerStyle: z.object({
        bold: z.boolean().optional(),
        fillColor: z.string().optional().describe("Hex color e.g. FF4472C4"),
        fontColor: z.string().optional().describe("Hex color e.g. FFFFFFFF"),
    }).optional().describe("Style for header row"),
    autoFilter: z.boolean().optional().describe("Enable auto-filter on data"),
    freezeHeader: z.boolean().optional().default(true).describe("Freeze the header row"),
});

type SpreadsheetAction = z.infer<typeof SpreadsheetActionSchema>;

export const spreadsheetTool: AgentTool<SpreadsheetAction> = {
    name: "spreadsheet",
    description: "Create, read, and edit Excel (.xlsx) spreadsheets with formatting, multiple sheets, headers, and data rows.",
    category: "utility",
    parameters: SpreadsheetActionSchema,

    async execute(params: SpreadsheetAction, _context: ToolCallContext): Promise<ToolResult> {
        try {
            switch (params.action) {
                case "create": {
                    await mkdir(dirname(params.path), { recursive: true });
                    const workbook = new ExcelJS.Workbook();
                    workbook.creator = "OpenWhale";
                    workbook.created = new Date();

                    const sheet = workbook.addWorksheet(params.sheetName);

                    // Set columns
                    if (params.columns) {
                        sheet.columns = params.columns.map(c => ({
                            header: c.header,
                            key: c.key,
                            width: c.width || 15,
                        }));
                    }

                    // Add rows
                    if (params.rows) {
                        for (const row of params.rows) {
                            sheet.addRow(row);
                        }
                    }

                    // Default styling: bold headers with color
                    const headerRow = sheet.getRow(1);
                    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
                    headerRow.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: params.headerStyle?.fillColor || "FF4472C4" },
                    };
                    headerRow.alignment = { vertical: "middle", horizontal: "center" };

                    // Auto-filter
                    if (params.autoFilter !== false && params.columns) {
                        sheet.autoFilter = {
                            from: "A1",
                            to: `${String.fromCharCode(64 + params.columns.length)}1`,
                        };
                    }

                    // Freeze header
                    if (params.freezeHeader !== false) {
                        sheet.views = [{ state: "frozen", ySplit: 1 }];
                    }

                    await workbook.xlsx.writeFile(params.path);
                    const rowCount = params.rows?.length || 0;

                    return {
                        success: true,
                        content: `Created spreadsheet: ${params.path} (${rowCount} rows, sheet: ${params.sheetName})`,
                        metadata: { path: params.path, rows: rowCount, sheet: params.sheetName },
                    };
                }

                case "read": {
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.readFile(params.path);
                    const sheet = params.sheet
                        ? workbook.getWorksheet(params.sheet)
                        : workbook.worksheets[0];

                    if (!sheet) {
                        return { success: false, content: "", error: `Sheet not found: ${params.sheet || "default"}` };
                    }

                    const data: Record<string, unknown>[] = [];
                    const headers: string[] = [];

                    sheet.eachRow((row, rowNumber) => {
                        if (rowNumber === 1) {
                            row.eachCell((cell) => {
                                headers.push(String(cell.value || ""));
                            });
                        } else {
                            const rowData: Record<string, unknown> = {};
                            row.eachCell((cell, colNumber) => {
                                rowData[headers[colNumber - 1] || `col${colNumber}`] = cell.value;
                            });
                            data.push(rowData);
                        }
                    });

                    return {
                        success: true,
                        content: JSON.stringify({ sheets: workbook.worksheets.map(s => s.name), headers, rowCount: data.length, data: data.slice(0, 50) }, null, 2),
                        metadata: { sheets: workbook.worksheets.map(s => s.name), rowCount: data.length },
                    };
                }

                case "add_sheet": {
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.readFile(params.path);
                    const sheet = workbook.addWorksheet(params.sheetName);

                    if (params.columns) {
                        sheet.columns = params.columns.map(c => ({
                            header: c.header, key: c.key, width: c.width || 15,
                        }));
                    }
                    if (params.rows) {
                        for (const row of params.rows) {
                            sheet.addRow(row);
                        }
                    }

                    await workbook.xlsx.writeFile(params.path);
                    return {
                        success: true,
                        content: `Added sheet "${params.sheetName}" to ${params.path}`,
                        metadata: { path: params.path, sheet: params.sheetName },
                    };
                }

                case "add_rows": {
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.readFile(params.path);
                    const sheet = params.sheet
                        ? workbook.getWorksheet(params.sheet)
                        : workbook.worksheets[0];

                    if (!sheet) {
                        return { success: false, content: "", error: "Sheet not found" };
                    }

                    const addedCount = params.rows?.length || 0;
                    if (params.rows) {
                        for (const row of params.rows) {
                            sheet.addRow(row);
                        }
                    }

                    await workbook.xlsx.writeFile(params.path);
                    return {
                        success: true,
                        content: `Added ${addedCount} rows to ${params.path}`,
                        metadata: { path: params.path, rowsAdded: addedCount },
                    };
                }

                case "format": {
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.readFile(params.path);
                    const sheet = params.sheet
                        ? workbook.getWorksheet(params.sheet)
                        : workbook.worksheets[0];

                    if (!sheet) {
                        return { success: false, content: "", error: "Sheet not found" };
                    }

                    if (params.headerStyle) {
                        const headerRow = sheet.getRow(1);
                        if (params.headerStyle.bold) headerRow.font = { bold: true };
                        if (params.headerStyle.fillColor) {
                            headerRow.fill = {
                                type: "pattern",
                                pattern: "solid",
                                fgColor: { argb: params.headerStyle.fillColor },
                            };
                        }
                        if (params.headerStyle.fontColor) {
                            headerRow.font = { ...headerRow.font, color: { argb: params.headerStyle.fontColor } };
                        }
                    }

                    await workbook.xlsx.writeFile(params.path);
                    return {
                        success: true,
                        content: `Formatted spreadsheet: ${params.path}`,
                        metadata: { path: params.path },
                    };
                }

                default:
                    return { success: false, content: "", error: `Unknown action: ${params.action}` };
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `Spreadsheet error: ${message}` };
        }
    },
};
