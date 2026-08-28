package main

import (
	"reflect"
	"testing"
)

func TestVacancyRenderParseRoundTrip(t *testing.T) {
	v := Vacancy{
		Status:      "new",
		Title:       "Backend Engineer",
		Company:     "Acme",
		Mails:       []string{"hr@acme.com", "jane@acme.com"},
		Description: "Line one\nLine two",
	}

	got := parseVacancy(v.Render())
	if !reflect.DeepEqual(got, v) {
		t.Fatalf("round trip mismatch: got %+v, want %+v", got, v)
	}
}

func TestParseVacancyNoMails(t *testing.T) {
	v := Vacancy{Status: "new", Title: "T", Company: "C", Description: "d"}
	got := parseVacancy(v.Render())
	if got.Mails != nil {
		t.Fatalf("expected nil mails, got %v", got.Mails)
	}
}

func TestParseVacancyNoBody(t *testing.T) {
	got := parseVacancy([]byte("Status: new\nTitle: T\nCompany: C\nMails: a@b.com\n"))
	if got.Status != "new" || got.Title != "T" || got.Company != "C" {
		t.Fatalf("unexpected header parse: %+v", got)
	}
	if got.Description != "" {
		t.Fatalf("expected empty description, got %q", got.Description)
	}
}

func TestSanitizeID(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"Acme - Backend Engineer", "Acme - Backend Engineer"},
		{"a/b\\c:d*e?f\"g<h>i|j", "abcdefghij"},
		{"  spaced   out  ", "spaced out"},
	}
	for _, c := range cases {
		if got := sanitizeID(c.in); got != c.want {
			t.Errorf("sanitizeID(%q) = %q, want %q", c.in, got, c.want)
		}
	}

	long := ""
	for i := 0; i < 200; i++ {
		long += "a"
	}
	if got := sanitizeID(long); len(got) != 150 {
		t.Errorf("expected truncation to 150 chars, got %d", len(got))
	}
}
