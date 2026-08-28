package main

import (
	"errors"
	"net/http"
)

func resolveDataDir(dataDir *string, r *http.Request) error {
	base := cfg.StorageDir

	if cfg.Mode == "local" {
		*dataDir = base + "/default"
		return nil
	}

	if cfg.Mode == "cloud" {
		// TODO: Implement user authentication and return the user ID from the request context or session.
		return errors.New("user authentication not implemented")
	}

	return errors.New("invalid configuration mode")
}
