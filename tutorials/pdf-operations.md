# PDF Operations

Create, read, merge, and manipulate PDF documents.

## Capabilities

- **Create** PDFs with text, images, tables
- **Read** and extract text from PDFs
- **Merge** multiple PDFs
- **Add** pages, headers, footers
- **Extract** specific pages

## Creating PDFs

### Simple document
```
Create a PDF with the title "Meeting Notes" and content about our Q4 goals
```

### With formatting
```
Create a professional PDF report with:
- Title: Annual Report 2024
- Sections: Overview, Financials, Outlook
- Include page numbers
```

### From data
```
Create a PDF invoice for order #1234:
- Customer: John Doe
- Items: Widget x3 at $10 each
- Total: $30
```

## Reading PDFs

### Extract text
```
Read the contents of contract.pdf
```

### Summarize
```
Read quarterly-report.pdf and give me the key points
```

### Search
```
Find all mentions of "revenue" in this PDF
```

## Merging PDFs

```
Merge report1.pdf, report2.pdf, and appendix.pdf into combined-report.pdf
```

## Extracting Pages

```
Extract pages 5-10 from manual.pdf and save as excerpt.pdf
```

## Advanced Examples

### Table of contents
```
Create a PDF with a clickable table of contents for my documentation
```

### Certificates
```
Generate 10 PDF certificates with names from participants.csv
```

### Reports with charts
```
Create a PDF report with a bar chart showing monthly sales data
```

## Tips

- PDFs are saved to `.openwhale-temp/` by default
- Images can be embedded from URLs or local files
- Tables are auto-formatted
- Headers/footers can include page numbers

## Output Location

Specify where to save:
```
Create a PDF and save it to ~/Documents/report.pdf
```
