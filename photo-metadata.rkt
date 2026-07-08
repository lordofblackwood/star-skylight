#lang racket/base

(require gregor
         racket/gui/base
         racket/format
         racket/file
         racket/list
         racket/path
         racket/port
         racket/runtime-path
         racket/string
         racket/system)

(provide get-observation-from-photo
         get-observation-from-photo/fallback
         get-current-mac-observation
         prompt-for-photo-observation
         (struct-out observation))

(struct observation [latitude longitude datetime source-path] #:transparent)

(define mdls-path
  (find-executable-path "mdls"))
(define swiftc-path
  (find-executable-path "swiftc"))
(define open-path
  (find-executable-path "open"))
(define-runtime-path current-location-script "current-location.swift")
(define-runtime-path current-location-info-plist "current-location-info.plist")
(define current-location-app
  (build-path (current-directory) ".build" "StarSkylightLocation.app"))
(define current-location-helper
  (build-path current-location-app "Contents" "MacOS" "current-location"))
(define current-location-plist
  (build-path current-location-app "Contents" "Info.plist"))

(define (helper-stale?)
  (or (not (file-exists? current-location-helper))
      (> (file-or-directory-modify-seconds current-location-script)
         (file-or-directory-modify-seconds current-location-helper))
      (> (file-or-directory-modify-seconds current-location-info-plist)
         (file-or-directory-modify-seconds current-location-helper))))

(define (mdls-raw attribute path)
  (unless mdls-path
    (error 'mdls-raw "mdls is required to read photo metadata on macOS"))
  (define output
    (with-output-to-string
      (lambda ()
        (system* mdls-path "-raw" "-name" attribute (path->string path)))))
  (string-trim output))

(define (metadata-value attribute path)
  (define value (mdls-raw attribute path))
  (and (not (member value '("(null)" "null" "")))
       value))

(define (metadata-number attribute path)
  (define value (metadata-value attribute path))
  (and value
       (string->number value)))

(define (metadata-datetime path)
  (define value
    (or (metadata-value "kMDItemContentCreationDate" path)
        (metadata-value "kMDItemFSCreationDate" path)))
  (cond
    [(and value (regexp-match #px"^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2})" value))
     => (lambda (match)
          (parse-datetime (second match) "yyyy-MM-dd HH:mm:ss"))]
    [else (now/utc)]))

(define (command-output executable . args)
  (define output (open-output-string))
  (define ok?
    (parameterize ([current-output-port output]
                   [current-error-port output])
      (apply system* executable args)))
  (define text (string-trim (get-output-string output)))
  (if ok?
      text
      (error 'command-output
             "~a failed: ~a"
             executable
             (if (string=? text "") "no output" text))))

(define (ensure-current-location-helper)
  (unless swiftc-path
    (error 'ensure-current-location-helper
           "swiftc is required to build the macOS current location helper"))
  (unless open-path
    (error 'ensure-current-location-helper
           "open is required to launch the macOS current location helper app"))
  (when (helper-stale?)
    (make-directory* (path-only current-location-helper))
    (copy-file current-location-info-plist current-location-plist #t)
    (define built?
      (system* swiftc-path
               (path->string current-location-script)
               "-o"
               (path->string current-location-helper)
               "-Xlinker" "-sectcreate"
               "-Xlinker" "__TEXT"
               "-Xlinker" "__info_plist"
               "-Xlinker" (path->string current-location-info-plist)))
    (unless built?
      (error 'ensure-current-location-helper
             "failed to build the macOS current location helper")))
  current-location-app)

(define (read-current-location-from-app)
  (define output-path (make-temporary-file "star-skylight-location-~a.txt"))
  (define app-path (ensure-current-location-helper))
  (define ok?
    (system* open-path
             "-W"
             (path->string app-path)
             "--args"
             (path->string output-path)))
  (define output
    (if (file-exists? output-path)
        (string-trim (file->string output-path))
        ""))
  (when (file-exists? output-path)
    (delete-file output-path))
  (unless ok?
    (error 'read-current-location-from-app
           "current location helper app failed: ~a"
           (if (string=? output "") "no output" output)))
  output)

(define (get-current-mac-observation [path #f] [datetime (now/utc)])
  (define output (read-current-location-from-app))
  (define pieces
    (and output
         (regexp-split #px"\\s+" output)))
  (define latitude
    (and pieces
         (>= (length pieces) 2)
         (string->number (first pieces))))
  (define longitude
    (and pieces
         (>= (length pieces) 2)
         (string->number (second pieces))))
  (unless (and latitude longitude)
    (error 'get-current-mac-observation
           "macOS current location was not available; helper output was: ~a"
           output))
  (observation latitude longitude datetime path))

(define (get-observation-from-photo path)
  (define latitude (metadata-number "kMDItemLatitude" path))
  (define longitude (metadata-number "kMDItemLongitude" path))
  (unless latitude
    (error 'get-observation-from-photo
           "photo does not expose GPS latitude metadata: ~a"
           path))
  (unless longitude
    (error 'get-observation-from-photo
           "photo does not expose GPS longitude metadata: ~a"
           path))
  (observation latitude longitude (metadata-datetime path) path))

(define (get-observation-from-photo/fallback path)
  (with-handlers ([exn:fail?
                   (lambda (_exn)
                     (get-current-mac-observation path (metadata-datetime path)))])
    (get-observation-from-photo path)))

(define (prompt-for-photo-observation)
  (define path
    (get-file "Choose a photo with location metadata"
              #f
              #f
              #f
              #f
              null
              '(("Image files" "*.jpg;*.jpeg;*.heic;*.png;*.tif;*.tiff")
                ("All files" "*.*"))))
  (if path
      (get-observation-from-photo/fallback path)
      (get-current-mac-observation)))
