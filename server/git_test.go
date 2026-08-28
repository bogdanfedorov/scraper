package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEnsureRepoIsIdempotent(t *testing.T) {
	dir := t.TempDir()
	if err := ensureRepo(dir); err != nil {
		t.Fatalf("ensureRepo: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, ".git")); err != nil {
		t.Fatalf(".git not created: %v", err)
	}
	if err := ensureRepo(dir); err != nil {
		t.Fatalf("ensureRepo (second call): %v", err)
	}
}

func TestEnsureRepoDoesNotEscapeToParentRepo(t *testing.T) {
	parent := t.TempDir()
	if err := ensureRepo(parent); err != nil {
		t.Fatalf("ensureRepo(parent): %v", err)
	}

	child := filepath.Join(parent, "nested")
	if err := os.MkdirAll(child, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := ensureRepo(child); err != nil {
		t.Fatalf("ensureRepo(child): %v", err)
	}
	if _, err := os.Stat(filepath.Join(child, ".git")); err != nil {
		t.Fatalf("expected nested repo to get its own .git: %v", err)
	}
}

func TestCommitFileSkipsWhenUnchanged(t *testing.T) {
	dir := t.TempDir()
	mustEnsureRepo(t, dir)

	path := filepath.Join(dir, "a.md")
	if err := os.WriteFile(path, []byte("content"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := commitFile(dir, "a.md", "first"); err != nil {
		t.Fatalf("commitFile: %v", err)
	}
	if err := commitFile(dir, "a.md", "second"); err != nil {
		t.Fatalf("commitFile (no-op): %v", err)
	}

	commits, err := logForFile(dir, "a.md")
	if err != nil {
		t.Fatalf("logForFile: %v", err)
	}
	if len(commits) != 1 {
		t.Fatalf("expected exactly 1 commit, got %d: %+v", len(commits), commits)
	}
}

func TestLogForFileTracksMultipleCommits(t *testing.T) {
	dir := t.TempDir()
	mustEnsureRepo(t, dir)

	path := filepath.Join(dir, "a.md")
	mustWriteAndCommit(t, dir, path, "a.md", "v1", "save: a")
	mustWriteAndCommit(t, dir, path, "a.md", "v2", "update: a")

	commits, err := logForFile(dir, "a.md")
	if err != nil {
		t.Fatalf("logForFile: %v", err)
	}
	if len(commits) != 2 {
		t.Fatalf("expected 2 commits, got %d", len(commits))
	}
	if commits[0].Message != "update: a" || commits[1].Message != "save: a" {
		t.Fatalf("unexpected commit order: %+v", commits)
	}
}

func TestLogForFileEmptyRepo(t *testing.T) {
	dir := t.TempDir()
	mustEnsureRepo(t, dir)

	commits, err := logForFile(dir, "missing.md")
	if err != nil {
		t.Fatalf("logForFile on empty repo should not error, got: %v", err)
	}
	if len(commits) != 0 {
		t.Fatalf("expected no commits, got %+v", commits)
	}
}

func TestLogAllAcrossFiles(t *testing.T) {
	dir := t.TempDir()
	mustEnsureRepo(t, dir)

	mustWriteAndCommit(t, dir, filepath.Join(dir, "a.md"), "a.md", "a", "save: a")
	mustWriteAndCommit(t, dir, filepath.Join(dir, "b.md"), "b.md", "b", "save: b")

	commits, err := logAll(dir)
	if err != nil {
		t.Fatalf("logAll: %v", err)
	}
	if len(commits) != 2 {
		t.Fatalf("expected 2 commits, got %d", len(commits))
	}
}

func TestShowFileAtCommit(t *testing.T) {
	dir := t.TempDir()
	mustEnsureRepo(t, dir)

	path := filepath.Join(dir, "a.md")
	mustWriteAndCommit(t, dir, path, "a.md", "v1", "save: a")
	commits, err := logForFile(dir, "a.md")
	if err != nil || len(commits) != 1 {
		t.Fatalf("logForFile: %v %+v", err, commits)
	}
	firstCommit := commits[0].Commit

	mustWriteAndCommit(t, dir, path, "a.md", "v2", "update: a")

	raw, err := showFileAtCommit(dir, firstCommit, "a.md")
	if err != nil {
		t.Fatalf("showFileAtCommit: %v", err)
	}
	if string(raw) != "v1" {
		t.Fatalf("expected old content %q, got %q", "v1", raw)
	}
}

func mustEnsureRepo(t *testing.T, dir string) {
	t.Helper()
	if err := ensureRepo(dir); err != nil {
		t.Fatalf("ensureRepo: %v", err)
	}
}

func mustWriteAndCommit(t *testing.T, dir, path, filename, content, message string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := commitFile(dir, filename, message); err != nil {
		t.Fatalf("commitFile: %v", err)
	}
}
