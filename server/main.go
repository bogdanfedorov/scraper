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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func handleSaveVacancy(w http.ResponseWriter, r *http.Request) {
	var v Vacancy
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var store Store
	if err := resolveDataDir(&store.Path, r); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	var forse bool
	if r.URL.Query().Get("force") == "true" {
		forse = true
	}
	if forse {
		if exists, err := store.Check(v.Filename()); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		} else if exists {
			writeError(w, http.StatusConflict, errors.New("vacancy already exists"))
			return
		}
	}

	if err := store.SaveVacancy(v); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, v)
}

type QueryVacancyRequest struct {
	Company string `json:"company"`
	Title   string `json:"title"`
}

func handleListVacancies(w http.ResponseWriter, r *http.Request) {
	var q QueryVacancyRequest
	if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var store Store
	if err := resolveDataDir(&store.Path, r); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	var filenames []string
	if err := store.FindLike(&filenames, q); err != nil {
		if errors.Is(err, NotMatchingFilesFound) {
			writeError(w, http.StatusNotFound, err)
		} else {
			writeError(w, http.StatusInternalServerError, err)
		}
		return
	}

	writeJSON(w, http.StatusOK, filenames)
}

func handleGetVacancy(w http.ResponseWriter, r *http.Request) {
	filename := r.PathValue("filename")
	var store Store
	if err := resolveDataDir(&store.Path, r); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	v, err := store.LoadVacancy(filename)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, err)
		} else {
			writeError(w, http.StatusInternalServerError, err)
		}
		return
	}

	writeJSON(w, http.StatusOK, v)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)

	mux.HandleFunc("PUT /vacancies", handleSaveVacancy)
	mux.HandleFunc("QUERY /vacancies/list", handleListVacancies)
	mux.HandleFunc("GET /vacancies/{filename}", handleGetVacancy)
	return mux
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, QUERY, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Id")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	cfg = Config{
		Mode:       envOr("MODE", "local"),
		StorageDir: envOr("STORAGE_DIR", "./data"),
		Port:       envOr("PORT", "8080"),
	}

	log.Printf("vacancy-server listening on :%s (mode=%s, storage=%s)", cfg.Port, cfg.Mode, cfg.StorageDir)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, withCORS(newMux())))
}
