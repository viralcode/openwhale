# Database Queries

Run SQL queries against various databases.

## Supported Databases

| Database | Connection String |
|----------|-------------------|
| SQLite | `sqlite:///path/to/db.sqlite` |
| PostgreSQL | `postgres://user:pass@host:5432/db` |
| MySQL | `mysql://user:pass@host:3306/db` |

## Basic Commands

### Query data
```
Query the users table and show the first 10 records
```

### Analyze
```
How many orders were placed in the last month?
```

### Schema info
```
What tables are in my database and what columns do they have?
```

## Configuration

Set your database in .env:
```env
DATABASE_URL=postgres://user:pass@localhost:5432/myapp
```

Or specify inline:
```
Connect to sqlite:///data/app.db and show all tables
```

## Examples

### Reporting
```
Generate a sales report grouped by product category for Q4
```

### Data exploration
```
Find customers who haven't made a purchase in 90 days
```

### Schema changes
```
Add a created_at column to the posts table
```

### Data export
```
Export all users to a CSV file
```

## Tips

- Read-only mode available for safety
- Query results formatted as tables
- Large results are paginated
- Joins and complex queries supported
