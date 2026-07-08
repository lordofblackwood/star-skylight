#lang racket/base
(require "solar-data.rkt"
         "nasa-api.rkt"
         "photo-metadata.rkt"
         gregor
         racket/date
         (except-in racket/gui
                    date?
                    date)
         racket/list
         racket/flonum
         racket/pretty
         racket/match)

(provide get-stars-above-me
         get-stars-above-me-at
         get-stars-above-me-url-at
         calc-right-ascension)


;; API requires right ascension and declination
;; For our purposes we will say the part of the galaxay
;; that is right above you, is where you are vertically
;; on the earth and how far the earth has turned from the
;; the sun.
;
;; That is to say declination = latitude
;; and right ascension = (Sun's RA@next solar noon - Sun's RA@prev solar noon) * % of time passed between the two
;

;; Right ascension, we will look at when local noon was
;; yesterday and today or today and tomorrow and see what
;; percent we are in-between and then look at the corresponding
;; sun location/right ascension and for yesterday/today/tomorrow
;; and then go the appropriate percentage between them.


(date-display-format 'iso-8601) 
;(define current-time (now/utc))
;(define curdate (date->string (current-date)))
;(define local-noon-datetime (string-append curdate " " (solar-noon latitude longitude "today")))
;(define today-local-noon (parse-datetime local-noon-datetime "yyyy-MM-dd h:mm:ss aa"))

;(-> Real Real Datetime Datetime Bitmap)
; Returns an image of the stars directly above you.
(define (get-stars-above-me lng lat)
  (get-stars-above-me-at lng lat (now/utc)))

;(-> Real Real Datetime Bitmap)
; Returns an image of the stars directly above a location at a specific time.
(define (get-stars-above-me-at lng lat when)
  (let ([declination (number->string lat)]
        ;; RA for UTC will be calculated and we will adjust by our longitude
        [right-ascension (number->string (+ lng (calc-right-ascension lng lat when (->date when))))])
    (get-nasa-image right-ascension declination)))

;(-> Real Real Datetime String)
; Returns the NASA SkyView image URL for the stars directly above a location at a specific time.
(define (get-stars-above-me-url-at lng lat when)
  (let ([declination (number->string lat)]
        ;; RA for UTC will be calculated and we will adjust by our longitude
        [right-ascension (number->string (+ lng (calc-right-ascension lng lat when (->date when))))])
    (get-nasa-image-url right-ascension declination)))

;(-> Real Real Dateime Datetime Datetime Real)
; Calculates the right ascention for the space that is above you right now.
(define (calc-right-ascension lng lat now todays-date)
  ;(display (map string->number (string-split (date->iso8601 (today/utc)) "-")))
    (let* ([today                     (date->iso8601 todays-date)]
           [yesterday                 (date->iso8601 (-days todays-date 1))]
           [tomorrow                  (date->iso8601 (+days todays-date 1))]
           [solar-noon-pair           (get-solar-noon-pair now yesterday today tomorrow lat lng)]
           [ra-pair                   (get-ra-pair now yesterday today tomorrow lat lng)]
           [percentage-between-noons  (percent-of-day-completed now solar-noon-pair)]
           [degrees-to-travel         (+ 360 (- (second ra-pair) (first ra-pair)))])
      (+ (car ra-pair) (* percentage-between-noons degrees-to-travel))))
           
;;Potentially could combine the bottom to into a sun-info struct and reduce api calls
;;repetitive code.

;; ((String String String -> String) String String -> (List String String))
;; Gets a data pair for a given function that is dependant on whether we passed local noon
;; or not by passing lng lat and the appropriate dates.
(define (get-data-pair get-data now yesterday today tomorrow lng lat)
  (if (past-todays-local-noon? now today lng lat)
    (list (get-data lng lat today) (get-data lng lat tomorrow))
    (list (get-data lng lat yesterday) (get-data lng lat today))))

;(-> String String (Pair String String))
; Gets the solar noon that most recently occurred and the solar noon that is going to occur next.
(define (get-solar-noon-pair now yesterday today tomorrow lng lat)
  (get-data-pair solar-noon now yesterday today tomorrow lng lat))

;(-> String String (Pair String String))
; Gets the right-ascension of the sun for the solar noon that
; most recently occurred and the solar noon that is going to occur next.
(define (get-ra-pair now yesterday today tomorrow lng lat)
  (get-data-pair get-sun-ra now yesterday today tomorrow lng lat))

;(-> Datetime Boolean)
; Determines if we are past the local noon for today.
(define (past-todays-local-noon? now today lng lat)
  (let ([solar-noon-today (parse-datetime (string-append (solar-noon lng lat today)) "yyyy-MM-dd h:mm:ss aa")])
    (datetime<? solar-noon-today now)))

;(-> Datetime (Pair String String) Number)
; Returns what percentage of the day has been completed,
; where the day is defined as the time between two solar noons
(define (percent-of-day-completed now solar-noon-pair)
  (let* ([as-datetime   (lambda (time)
                              (parse-datetime time "yyyy-MM-dd h:mm:ss aa"))]
        [solar-day      (minutes-between (as-datetime (first solar-noon-pair))
                                         (as-datetime (second solar-noon-pair)))]
        [day-completed  (minutes-between (as-datetime (first solar-noon-pair)) now)])
    (/ (->fl day-completed) solar-day)))

(define (save-stars-image bitmap path)
  (unless (send bitmap save-file (path->string path) 'png)
    (error 'save-stars-image "could not save PNG to ~a" path)))

(define (prompt-and-save-stars-image parent bitmap)
  (define path
    (put-file "Save stars image"
              parent
              #f
              "stars-above-me.png"
              "png"
              null
              '(("PNG image" "*.png")
                ("All files" "*.*"))))
  (when path
    (save-stars-image bitmap path)
    (message-box "Saved"
                 (format "Saved stars image to ~a" path)
                 parent)))

(define (parse-command-line args)
  (match (vector->list args)
    ['()
     (values #f #f)]
    [(list "--save" output-path)
     (values #f (string->path output-path))]
    [(list photo-path)
     (values (string->path photo-path) #f)]
    [(list photo-path "--save" output-path)
     (values (string->path photo-path) (string->path output-path))]
    [_
     (error 'star-skylight
            "usage: racket star-skylight.rkt [photo-path] [--save output.png]")]))

(module+ main 
  (define-values (photo-path save-path)
    (parse-command-line (current-command-line-arguments)))
  (define f (new frame% [label "Stars Above me Right Now"]))
  (define OBSERVATION
    (if photo-path
        (get-observation-from-photo/fallback photo-path)
        (get-current-mac-observation)))
  (define STARS-IMAGE
    (get-stars-above-me-at
     (observation-longitude OBSERVATION)
     (observation-latitude OBSERVATION)
     (observation-datetime OBSERVATION)))
  (when save-path
    (save-stars-image STARS-IMAGE save-path)
    (displayln (format "Saved stars image to ~a" save-path)))
  (define panel
    (new vertical-panel%
         [parent f]
         [alignment '(center center)]))
  (void (new message%
             [parent panel]
             [label STARS-IMAGE]))
  (void (new button%
             [parent panel]
             [label "Save PNG..."]
             [callback
              (lambda (_button _event)
                (prompt-and-save-stars-image f STARS-IMAGE))]))
  (send f show #t)
  (void))
