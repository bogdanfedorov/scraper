package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func setTestConfig(t *testing.T, mode string) {
	t.Helper()
	old := cfg
	cfg = Config{Mode: mode, StorageDir: t.TempDir()}
	t.Cleanup(func() { cfg = old })
}

func doRequest(t *testing.T, mux *http.ServeMux, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func TestHandleSaveAndGetVacancy(t *testing.T) {
	setTestConfig(t, "local")
	mux := newMux()

	body := `{"status":"new","title":"Backend","company":"Acme","mails":["hr@acme.com"],"description":"desc"}`
	rec := doRequest(t, mux, http.MethodPut, "/vacancies/test-1", body, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT status = %d, body = %s", rec.Code, rec.Body)
	}

	rec = doRequest(t, mux, http.MethodGet, "/vacancies/test-1", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET status = %d, body = %s", rec.Code, rec.Body)
	}
	var v Vacancy
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if v.Title != "Backend" || v.Company != "Acme" {
		t.Fatalf("unexpected vacancy: %+v", v)
	}
}

func TestHandleHealth(t *testing.T) {
	setTestConfig(t, "local")
	mux := newMux()

	rec := doRequest(t, mux, http.MethodGet, "/health", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestHandleGetVacancyNotFound(t *testing.T) {
	setTestConfig(t, "local")
	mux := newMux()

	rec := doRequest(t, mux, http.MethodGet, "/vacancies/missing", "", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestHandleSaveVacancyEmptyID(t *testing.T) {
	setTestConfig(t, "local")
	mux := newMux()

	rec := doRequest(t, mux, http.MethodPut, "/vacancies/***", `{"status":"new"}`, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for id that sanitizes to empty, got %d, body=%s", rec.Code, rec.Body)
	}
}

func TestHandleSaveVacancyBadJSON(t *testing.T) {
	setTestConfig(t, "local")
	mux := newMux()

	rec := doRequest(t, mux, http.MethodPut, "/vacancies/test-1", "not-json", nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid JSON, got %d", rec.Code)
	}
}

func TestHandleListVacancies(t *testing.T) {
	setTestConfig(t, "local")
	mux := newMux()

	doRequest(t, mux, http.MethodPut, "/vacancies/a", `{"status":"new","title":"A"}`, nil)
	doRequest(t, mux, http.MethodPut, "/vacancies/b", `{"status":"applied","title":"B"}`, nil)

	rec := doRequest(t, mux, http.MethodGet, "/vacancies", "", nil)
	var summaries []VacancySummary
	if err := json.Unmarshal(rec.Body.Bytes(), &summaries); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(summaries) != 2 {
		t.Fatalf("expected 2 summaries, got %d: %+v", len(summaries), summaries)
	}
}

func TestHandleHistoryAndTimeline(t *testing.T) {
	setTestConfig(t, "local")
	mux := newMux()

	doRequest(t, mux, http.MethodPut, "/vacancies/test-1", `{"status":"new","title":"T"}`, nil)
	doRequest(t, mux, http.MethodPut, "/vacancies/test-1", `{"status":"applied","title":"T"}`, nil)

	rec := doRequest(t, mux, http.MethodGet, "/vacancies/test-1/history", "", nil)
	var history []CommitInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &history); err != nil {
		t.Fatalf("unmarshal history: %v", err)
	}
	if len(history) != 2 {
		t.Fatalf("expected 2 history entries, got %d", len(history))
	}

	rec = doRequest(t, mux, http.MethodGet, "/vacancies/test-1/history/"+history[1].Commit, "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("history-at-commit status = %d, body = %s", rec.Code, rec.Body)
	}
	var v Vacancy
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("unmarshal vacancy at commit: %v", err)
	}
	if v.Status != "new" {
		t.Fatalf("expected original status at first commit, got %q", v.Status)
	}

	rec = doRequest(t, mux, http.MethodGet, "/timeline", "", nil)
	var timeline []CommitInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &timeline); err != nil {
		t.Fatalf("unmarshal timeline: %v", err)
	}
	if len(timeline) != 2 {
		t.Fatalf("expected 2 timeline entries, got %d", len(timeline))
	}
}

func TestHandleVacancyRawRoundTrip(t *testing.T) {
	setTestConfig(t, "local")
	mux := newMux()

	doRequest(t, mux, http.MethodPut, "/vacancies/test-1", `{"status":"new","title":"T","company":"C","description":"d"}`, nil)

	rec := doRequest(t, mux, http.MethodGet, "/vacancies/test-1/raw", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET raw status = %d, body = %s", rec.Code, rec.Body)
	}
	raw := rec.Body.String()
	if !strings.Contains(raw, "Status: new") || !strings.Contains(raw, "Title: T") {
		t.Fatalf("unexpected raw content: %q", raw)
	}

	edited := strings.Replace(raw, "Status: new", "Status: applied", 1)
	rec = doRequest(t, mux, http.MethodPut, "/vacancies/test-1/raw", edited, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT raw status = %d, body = %s", rec.Code, rec.Body)
	}
	var v Vacancy
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if v.Status != "applied" {
		t.Fatalf("expected updated status, got %+v", v)
	}

	history, err := logForFile(cfg.StorageDir, "test-1.md")
	if err != nil || len(history) != 2 {
		t.Fatalf("expected 2 commits after raw edit, got %+v (err=%v)", history, err)
	}
}

func TestHandleGetVacancyRawNotFound(t *testing.T) {
	setTestConfig(t, "local")
	mux := newMux()

	rec := doRequest(t, mux, http.MethodGet, "/vacancies/missing/raw", "", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestCloudModeIsolatesUsers(t *testing.T) {
	setTestConfig(t, "cloud")
	mux := newMux()

	doRequest(t, mux, http.MethodPut, "/vacancies/v1", `{"status":"new","title":"A"}`, map[string]string{"X-User-Id": "alice"})
	doRequest(t, mux, http.MethodPut, "/vacancies/v1", `{"status":"new","title":"B"}`, map[string]string{"X-User-Id": "bob"})

	rec := doRequest(t, mux, http.MethodGet, "/vacancies/v1", "", map[string]string{"X-User-Id": "alice"})
	var alice Vacancy
	if err := json.Unmarshal(rec.Body.Bytes(), &alice); err != nil {
		t.Fatalf("unmarshal alice: %v", err)
	}
	if alice.Title != "A" {
		t.Fatalf("expected alice's vacancy, got %+v", alice)
	}

	rec = doRequest(t, mux, http.MethodGet, "/vacancies/v1", "", map[string]string{"X-User-Id": "bob"})
	var bob Vacancy
	if err := json.Unmarshal(rec.Body.Bytes(), &bob); err != nil {
		t.Fatalf("unmarshal bob: %v", err)
	}
	if bob.Title != "B" {
		t.Fatalf("expected bob's vacancy, got %+v", bob)
	}
}
