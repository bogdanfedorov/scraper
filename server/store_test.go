package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestResolveUserID(t *testing.T) {
	old := cfg
	defer func() { cfg = old }()

	cfg.Mode = "local"
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-User-Id", "alice")
	if got := resolveUserID(r); got != "" {
		t.Fatalf("local mode should ignore X-User-Id, got %q", got)
	}

	cfg.Mode = "cloud"
	if got := resolveUserID(r); got != "alice" {
		t.Fatalf("cloud mode should use X-User-Id, got %q", got)
	}

	r2 := httptest.NewRequest(http.MethodGet, "/", nil)
	if got := resolveUserID(r2); got != "default" {
		t.Fatalf("cloud mode without header should fall back to default, got %q", got)
	}
}

func TestSaveAndLoadVacancy(t *testing.T) {
	dir := t.TempDir()
	v := Vacancy{Status: "new", Title: "T", Company: "C", Description: "d"}

	if err := saveVacancy(dir, "test-1", v); err != nil {
		t.Fatalf("saveVacancy: %v", err)
	}

	got, err := loadVacancy(dir, "test-1")
	if err != nil {
		t.Fatalf("loadVacancy: %v", err)
	}
	if got.Title != v.Title || got.Status != v.Status {
		t.Fatalf("loaded vacancy mismatch: %+v", got)
	}

	commits, err := logForFile(dir, "test-1.md")
	if err != nil || len(commits) != 1 || commits[0].Message != "save: test-1" {
		t.Fatalf("expected single save commit, got %+v (err=%v)", commits, err)
	}
}

func TestSaveVacancyTwiceCommitsUpdate(t *testing.T) {
	dir := t.TempDir()
	v := Vacancy{Status: "new", Title: "T", Company: "C", Description: "d"}

	if err := saveVacancy(dir, "test-1", v); err != nil {
		t.Fatalf("saveVacancy (1st): %v", err)
	}
	v.Status = "applied"
	if err := saveVacancy(dir, "test-1", v); err != nil {
		t.Fatalf("saveVacancy (2nd): %v", err)
	}

	commits, err := logForFile(dir, "test-1.md")
	if err != nil {
		t.Fatalf("logForFile: %v", err)
	}
	if len(commits) != 2 || commits[0].Message != "update: test-1" || commits[1].Message != "save: test-1" {
		t.Fatalf("unexpected commits: %+v", commits)
	}
}

func TestLoadVacancyNotFound(t *testing.T) {
	dir := t.TempDir()
	_, err := loadVacancy(dir, "missing")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestListVacancies(t *testing.T) {
	dir := t.TempDir()
	if err := saveVacancy(dir, "a", Vacancy{Status: "new", Title: "A", Company: "C1"}); err != nil {
		t.Fatal(err)
	}
	if err := saveVacancy(dir, "b", Vacancy{Status: "applied", Title: "B", Company: "C2"}); err != nil {
		t.Fatal(err)
	}

	summaries, err := listVacancies(dir)
	if err != nil {
		t.Fatalf("listVacancies: %v", err)
	}
	if len(summaries) != 2 {
		t.Fatalf("expected 2 summaries, got %d: %+v", len(summaries), summaries)
	}
}

func TestListVacanciesEmptyDir(t *testing.T) {
	dir := t.TempDir()
	summaries, err := listVacancies(dir)
	if err != nil {
		t.Fatalf("listVacancies on missing dir should not error, got %v", err)
	}
	if len(summaries) != 0 {
		t.Fatalf("expected no summaries, got %+v", summaries)
	}
}
