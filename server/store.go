package main

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
)

var ErrNotFound = errors.New("vacancy not found")

func resolveUserID(r *http.Request) string {
	if cfg.Mode == "cloud" {
		if id := r.Header.Get("X-User-Id"); id != "" {
			return id
		}
		return "default"
	}
	return ""
}

func repoDir(userID string) string {
	if userID == "" {
		return cfg.StorageDir
	}
	return filepath.Join(cfg.StorageDir, userID)
}

func vacancyPath(dir, id string) string {
	return filepath.Join(dir, id+".md")
}

func saveVacancy(dir, id string, v Vacancy) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if err := ensureRepo(dir); err != nil {
		return err
	}

	filename := id + ".md"
	path := vacancyPath(dir, id)
	_, statErr := os.Stat(path)

	if err := os.WriteFile(path, v.Render(), 0o644); err != nil {
		return err
	}

	message := "save: " + id
	if statErr == nil {
		message = "update: " + id
	}
	return commitFile(dir, filename, message)
}

func loadVacancy(dir, id string) (Vacancy, error) {
	raw, err := os.ReadFile(vacancyPath(dir, id))
	if errors.Is(err, os.ErrNotExist) {
		return Vacancy{}, ErrNotFound
	}
	if err != nil {
		return Vacancy{}, err
	}
	return parseVacancy(raw), nil
}

type VacancySummary struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Title   string `json:"title"`
	Company string `json:"company"`
}

func listVacancies(dir string) ([]VacancySummary, error) {
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var summaries []VacancySummary
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".md" {
			continue
		}
		id := entry.Name()[:len(entry.Name())-len(".md")]
		v, err := loadVacancy(dir, id)
		if err != nil {
			continue
		}
		summaries = append(summaries, VacancySummary{ID: id, Status: v.Status, Title: v.Title, Company: v.Company})
	}
	return summaries, nil
}
