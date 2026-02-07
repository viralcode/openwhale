# Notion Skill

Access and manage Notion pages and databases.

## Setup

1. Go to https://www.notion.so/my-integrations
2. Create a new integration
3. Copy the **Internal Integration Token**
4. Add to `.env`:
   ```env
   NOTION_TOKEN=secret_xxxxxxxxxxxxx
   ```
5. In Notion, share your pages/databases with the integration

## Capabilities

- Search pages
- Read page content
- Create pages
- Update pages
- Query databases

## Examples

### Search
```
Find my Notion page about project planning
```

### Read
```
Show me the contents of my "Meeting Notes" page
```

### Create
```
Create a new Notion page titled "Q1 Goals" with sections for each month
```

### Databases
```
List all items in my Tasks database where status is "In Progress"
```

### Update
```
Add a new section to my "Product Roadmap" page about the mobile app
```

## Tips

- Integration must be shared on each page/database
- Full markdown support
- Database queries support filters and sorts
- Blocks (paragraphs, lists, etc.) fully supported
