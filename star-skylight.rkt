#lang racket/base
(require "geo-locate-api.rkt"
         "solar-data.rkt"
         gregor
         racket/date
         racket/list
         racket/pretty)


(define latitude (coords-latitude LOCATION))
(define longitude (coords-longitude LOCATION))

;; API requires right ascension and declination
;; For our purposes we will say the part of the galaxay
;; that is right above you, is where you are vertically
;; on the earth and how far the earth has turned from the
;; the sun.
;
(define DECLINATION longitude)

;; Right ascension, we will look at when local noon was
;; yesterday and today or today and tomorrow and see what
;; percent we are inbetween and then look at the corresponding
;; sun location/right ascension and for yesterday/today/tomorrow
;; and then go the approrpiate percentage between them.

;(define RIGHT-ASCENSION )

(date-display-format 'iso-8601) 
(define current-time (now/utc))
(define curdate (date->string (current-date)))
(define local-noon-datetime (string-append curdate " " (solar-noon latitude longitude "today")))
(define today-local-noon (parse-datetime local-noon-datetime "yyyy-MM-dd h:mm:ss aa"))
(pretty-print current-time)
(pretty-print today-local-noon)

;(define sun-init-ra )
;(define sun-final-ra )

;(-> Real Real Image)
; Returns an image of the stars directly above you.
#;(define (get-stars-above-me lng lat)
  (let ([declincation lng]
        [right-ascension (calc-right-ascention lng lat)])
    (get-nasa-image declintation right-ascension)))

;(-> Real Real Real)
; Calculates the right ascention for the space that is above you right now.
#;(define (calc-right-ascension lng lat)
    (let* ([now (now/utc)]
           [yesterday ]
           [tomorrow ]
           [solar-noon-pair (get-solar-noon-pair yesterday tomorrow)]
           [ra-pair (get-ra-pair yesterday tomorrow)]
           [percentage-between-noons (percent-of-day-completed now solar-noon-pair)]
           [degrees-to-travel (+ 360 (- (cdr ra-pair) (car ra-pair)))])
      (+ (car ra-pair) (* percentage-between-noons degrees-to-travel))))
           
;;Potentially could combine the bottom to into a sun-info struct and reduce api calls
;;repetitive code.

;(-> String String (Pair String String))
; Gets the solar noon that most recently occurred and the solar noon that is going to occur next.
(define (get-solar-noon-pair now yesterday tomorrow lng lat)
  (if (past-todays-local-noon? now)
    (cons (solar-noon lng lat "today") (solar-noon lng lat tomorrow))
    (cons (solar-noon lng lat yesterday) (solar-noon lng lat "today"))))

;(-> String String (Pair String String))
; Gets the right-ascension of the sun for the solar noon that
; most recently occurred and the solar noon that is going to occur next.
#;(define (get-ra-pair now yesterday tomorrow)
  (if (past-todays-local-noon? now lng lat)
    (cons (get-sun-ra lng lat "today") (get-sun-ra lng lat tomorrow))
    (cons (get-sun-ra lng lat yesterday) (get-sun-ra lng lat "today"))))

;(-> Datetime Boolean)
; Determines if we past the local noon for today.
(define (past-todays-local-noon? now lng lat)
  (let ([solar-noon-today (parse-datetime (string-append curdate " " (solar-noon lng lat "today")) "yyyy-MM-dd h:mm:ss aa")])
    (datetime<? solar-noon-today now)))

