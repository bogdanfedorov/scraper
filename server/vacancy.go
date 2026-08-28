package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

type Vacancy struct {
	Status      string `json:"status"`
	Title       string `json:"title"`
	Company     string `json:"company"`
	URL         string `json:"url"`
	Description string `json:"description"`
}

func (v Vacancy) URLHash() string {
	hasher := sha256.New()
	hasher.Write([]byte(v.URL))
	hashBytes := hasher.Sum(nil)
	return hex.EncodeToString(hashBytes)
}

func (v Vacancy) Filename() string {
	return v.Company + " - " + v.Title + " - " + v.URLHash() + ".md"
}

func (v Vacancy) EncodeToMD() []byte {
	var b strings.Builder
	fmt.Fprintf(&b, "Status: %s\n", v.Status)
	fmt.Fprintf(&b, "Title: %s\n", v.Title)
	fmt.Fprintf(&b, "Company: %s\n", v.Company)
	fmt.Fprintf(&b, "URL: %s\n", v.URL)
	b.WriteString("\n")
	b.WriteString(strings.TrimRight(v.Description, "\n"))
	b.WriteString("\n")
	return []byte(b.String())
}

func ParseVacancy(raw []byte) Vacancy {
	header, description, _ := strings.Cut(string(raw), "\n\n")

	var v Vacancy
	for _, line := range strings.Split(header, "\n") {
		if rest, ok := strings.CutPrefix(line, "Status: "); ok {
			v.Status = rest
		} else if rest, ok := strings.CutPrefix(line, "Title: "); ok {
			v.Title = rest
		} else if rest, ok := strings.CutPrefix(line, "Company: "); ok {
			v.Company = rest
		} else if rest, ok := strings.CutPrefix(line, "URL: "); ok {
			v.URL = rest
		}
	}
	v.Description = strings.TrimRight(description, "\n")
	return v
}
