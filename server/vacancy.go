package main

import (
	"fmt"
	"regexp"
	"strings"
)

type Vacancy struct {
	Status      string   `json:"status"`
	Title       string   `json:"title"`
	Company     string   `json:"company"`
	Mails       []string `json:"mails"`
	Description string   `json:"description"`
}

var idSanitizer = regexp.MustCompile(`[^a-zA-Z0-9А-Яа-яІіЇїЄєҐґ._ -]`)

func sanitizeID(name string) string {
	name = idSanitizer.ReplaceAllString(name, "")
	name = strings.Join(strings.Fields(name), " ")
	name = strings.TrimSpace(name)
	if len(name) > 150 {
		name = name[:150]
	}
	return name
}

func (v Vacancy) Render() []byte {
	var b strings.Builder
	fmt.Fprintf(&b, "Status: %s\n", v.Status)
	fmt.Fprintf(&b, "Title: %s\n", v.Title)
	fmt.Fprintf(&b, "Company: %s\n", v.Company)
	fmt.Fprintf(&b, "Mails: %s\n", strings.Join(v.Mails, ", "))
	b.WriteString("\n")
	b.WriteString(strings.TrimRight(v.Description, "\n"))
	b.WriteString("\n")
	return []byte(b.String())
}

func parseVacancy(raw []byte) Vacancy {
	text := string(raw)
	header, body, found := strings.Cut(text, "\n\n")
	if !found {
		header, body = text, ""
	}

	v := Vacancy{Description: strings.TrimSpace(body)}
	for _, line := range strings.Split(header, "\n") {
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		value = strings.TrimSpace(value)
		switch strings.TrimSpace(key) {
		case "Status":
			v.Status = value
		case "Title":
			v.Title = value
		case "Company":
			v.Company = value
		case "Mails":
			v.Mails = splitMails(value)
		}
	}
	return v
}

func splitMails(value string) []string {
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	mails := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			mails = append(mails, p)
		}
	}
	return mails
}
