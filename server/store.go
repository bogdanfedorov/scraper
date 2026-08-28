package main

import (
	"errors"
	"io/fs"
)

var ErrNotFound = errors.New("vacancy not found")
var NotMatchingFilesFound = errors.New("no matching files found")

type Store struct {
	Path string
}

func (s *Store) SaveVacancy(v Vacancy) error {
	return errors.New("not implemented")
}

func (s *Store) LoadVacancy(filename string) (Vacancy, error) {
	return Vacancy{}, errors.New("not implemented")
}

func (s *Store) ListVacancies() ([]string, error) {
	return nil, errors.New("not implemented")
}

func (s *Store) Check(partialFilename string) (bool, error) {
	return false, errors.New("not implemented")
}

func (s *Store) FindLike(*	fileList []string, partsOfFilename []string) error {
	var fsys []string
	
	for _, part := range partsOfFilename {
		matches, err := fs.Glob(os.DirFS(s.Path), "*"+part+"*")
		if err != nil {
			return nil, err
		}
		fileList = append(fileList, matches...)
	}

	if len(fileList) > 0 {
		return nil, nil
	}

	return nil, NotMatchingFilesFound
}