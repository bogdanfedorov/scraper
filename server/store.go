package main

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
)

var ErrNotFound = errors.New("vacancy not found")
var NotMatchingFilesFound = errors.New("no matching files found")

type Store struct {
	Path string
}

func (s *Store) SaveVacancy(v Vacancy) error {
	if err := os.MkdirAll(s.Path, 0o755); err != nil {
		return err
	}
	if err := ensureRepo(s.Path); err != nil {
		return err
	}

	filename := v.Filename()
	path := filepath.Join(s.Path, filename)
	_, statErr := os.Stat(path)

	if err := os.WriteFile(path, v.EncodeToMD(), 0o644); err != nil {
		return err
	}

	message := "save: " + filename
	if statErr == nil {
		message = "update: " + filename
	}
	return commitFile(s.Path, filename, message)
}

func (s *Store) LoadVacancy(filename string) (Vacancy, error) {
	raw, err := os.ReadFile(filepath.Join(s.Path, filename))
	if errors.Is(err, os.ErrNotExist) {
		return Vacancy{}, ErrNotFound
	}
	if err != nil {
		return Vacancy{}, err
	}
	return ParseVacancy(raw), nil
}

func (s *Store) ListVacancies() ([]string, error) {
	entries, err := os.ReadDir(s.Path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var filenames []string
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".md" {
			continue
		}
		filenames = append(filenames, entry.Name())
	}
	return filenames, nil
}

func (s *Store) Check(filename string) (bool, error) {
	_, err := os.Stat(filepath.Join(s.Path, filename))
	if err == nil {
		return true, nil
	}
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	return false, err
}

func (s *Store) FindLike(fileList *[]string, partsOfFilename []string) error {
	seen := make(map[string]bool)
	fsys := os.DirFS(s.Path)

	for _, part := range partsOfFilename {
		matches, err := fs.Glob(fsys, "*"+part+"*")
		if err != nil {
			return err
		}
		for _, m := range matches {
			if seen[m] {
				continue
			}
			seen[m] = true
			*fileList = append(*fileList, m)
		}
	}

	if len(*fileList) == 0 {
		return NotMatchingFilesFound
	}
	return nil
}
