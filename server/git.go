package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var gitMu sync.Mutex

type CommitInfo struct {
	Commit  string    `json:"commit"`
	Date    time.Time `json:"date"`
	Message string    `json:"message"`
}

func runGit(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, out)
	}
	return string(out), nil
}

func ensureRepo(dir string) error {
	gitMu.Lock()
	defer gitMu.Unlock()

	if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
		return nil
	}
	if _, err := runGit(dir, "init"); err != nil {
		return err
	}
	_, _ = runGit(dir, "config", "user.name", "vacancy-server")
	_, _ = runGit(dir, "config", "user.email", "vacancy-server@local")
	return nil
}

func commitFile(dir, filename, message string) error {
	gitMu.Lock()
	defer gitMu.Unlock()

	if _, err := runGit(dir, "add", filename); err != nil {
		return err
	}
	if _, err := runGit(dir, "diff", "--cached", "--quiet"); err == nil {
		return nil
	}
	_, err := runGit(dir, "commit", "-m", message)
	return err
}

const logFormat = "%H%x1f%aI%x1f%s%x1e"

func parseLog(raw string) []CommitInfo {
	var commits []CommitInfo
	for _, entry := range strings.Split(raw, "\x1e") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		fields := strings.Split(entry, "\x1f")
		if len(fields) != 3 {
			continue
		}
		date, err := time.Parse(time.RFC3339, fields[1])
		if err != nil {
			continue
		}
		commits = append(commits, CommitInfo{Commit: fields[0], Date: date, Message: fields[2]})
	}
	return commits
}

func logForFile(dir, filename string) ([]CommitInfo, error) {
	out, err := runGit(dir, "log", "--follow", "--pretty=format:"+logFormat, "--", filename)
	if err != nil {
		if strings.Contains(err.Error(), "does not have any commits yet") {
			return nil, nil
		}
		return nil, err
	}
	return parseLog(out), nil
}

func logAll(dir string) ([]CommitInfo, error) {
	out, err := runGit(dir, "log", "--pretty=format:"+logFormat)
	if err != nil {
		if strings.Contains(err.Error(), "does not have any commits yet") {
			return nil, nil
		}
		return nil, err
	}
	return parseLog(out), nil
}

func showFileAtCommit(dir, commit, filename string) ([]byte, error) {
	out, err := runGit(dir, "show", commit+":"+filename)
	if err != nil {
		return nil, err
	}
	return []byte(out), nil
}
