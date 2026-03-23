package database

import (
	"database/sql"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// RunMigrations applies pending schema migrations to the specified SQLite database.
func RunMigrations(db *sql.DB, migrationsPath string) error {
	driver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		return fmt.Errorf("could not create sqlite3 driver instance for migrations: %w", err)
	}

	// Create a new migrate instance using the provided path to migration files
	// Examples for migrationsPath: "file://database/migrations"
	m, err := migrate.NewWithDatabaseInstance(
		migrationsPath,
		"sqlite3", 
		driver,
	)
	if err != nil {
		return fmt.Errorf("could not create migrate instance: %w", err)
	}

	// Execute the "Up" migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("could not apply up migrations: %w", err)
	}

	return nil
}
