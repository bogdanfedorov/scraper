package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
)

type Config struct {
	Mode       string
	StorageDir string
	Port       string
}

var cfg Config

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func handleSaveVacancy(w http.ResponseWriter, r *http.Request) {
	id := sanitizeID(r.PathValue("id"))
	if id == "" {
		writeError(w, http.StatusBadRequest, errors.New("empty id"))
		return
	}

	var v Vacancy
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	dir := repoDir(resolveUserID(r))
	if err := saveVacancy(dir, id, v); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, v)
}

func handleGetVacancy(w http.ResponseWriter, r *http.Request) {
	id := sanitizeID(r.PathValue("id"))
	dir := repoDir(resolveUserID(r))

	v, err := loadVacancy(dir, id)
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, err)
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, v)
}

func handleListVacancies(w http.ResponseWriter, r *http.Request) {
	dir := repoDir(resolveUserID(r))
	summaries, err := listVacancies(dir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, summaries)
}

func handleVacancyHistory(w http.ResponseWriter, r *http.Request) {
	id := sanitizeID(r.PathValue("id"))
	dir := repoDir(resolveUserID(r))

	commits, err := logForFile(dir, id+".md")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, commits)
}

func handleVacancyAtCommit(w http.ResponseWriter, r *http.Request) {
	id := sanitizeID(r.PathValue("id"))
	commit := r.PathValue("commit")
	dir := repoDir(resolveUserID(r))

	raw, err := showFileAtCommit(dir, commit, id+".md")
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, parseVacancy(raw))
}

func handleTimeline(w http.ResponseWriter, r *http.Request) {
	dir := repoDir(resolveUserID(r))
	commits, err := logAll(dir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, commits)
}

func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("PUT /vacancies/{id}", handleSaveVacancy)
	mux.HandleFunc("GET /vacancies/{id}", handleGetVacancy)
	mux.HandleFunc("GET /vacancies", handleListVacancies)
	mux.HandleFunc("GET /vacancies/{id}/history", handleVacancyHistory)
	mux.HandleFunc("GET /vacancies/{id}/history/{commit}", handleVacancyAtCommit)
	mux.HandleFunc("GET /timeline", handleTimeline)
	return mux
}

func main() {
	cfg = Config{
		Mode:       envOr("MODE", "local"),
		StorageDir: envOr("STORAGE_DIR", "./data"),
		Port:       envOr("PORT", "8080"),
	}

	log.Printf("vacancy-server listening on :%s (mode=%s, storage=%s)", cfg.Port, cfg.Mode, cfg.StorageDir)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, newMux()))
}
