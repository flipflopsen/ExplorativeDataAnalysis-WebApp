#!/bin/bash

echo "--- 📂 Updating Project Structure to Support SQLite DB ---"

# Check if the databases directory exists, if not, create it
if [ ! -d "01_data/databases" ]; then
    mkdir -p "01_data/databases"
    echo "Created subdirectory for the database file."
fi

# Create a placeholder SQLite database file (This file will store the DB)
# NOTE: If the file exists, 'touch' won't complain, but it ensures the placeholder exists.
touch "01_data/databases/project_data.db"

echo ""
echo "✅ SQLite support integrated into the structure."
echo "The main database file will live at 01_data/databases/project_data.db"
