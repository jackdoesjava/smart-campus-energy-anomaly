package database

import (
	"database/sql"
	_ "embed"
	"fmt"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed schema.sql
var schemaSQL string

// InitDB opens the SQLite connection and executes the initial schema migrations.
func InitDB(dataSourceName string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dataSourceName)
	if err != nil {
		return nil, fmt.Errorf("error opening database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("error pinging the database: %w", err)
	}

	// Execute migrations on startup
	if _, err := db.Exec(schemaSQL); err != nil {
		return nil, fmt.Errorf("error executing schema migrations: %w", err)
	}

	log.Println("SQLite database initialized and migrations applied successfully.")
	return db, nil
}
