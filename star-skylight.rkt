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
(define today-local-noon (parse-datetime local-noon-datetime "yyyy-mm-dd h:mm:ss aa"))
(pretty-print current-time)
(pretty-print today-local-noon)

;(define sun-init-ra )
;(define sun-final-ra )

;(-> Image)
; Returns an image of the stars directly above you.
#;(define (get-stars-above-me)
  (let ([declincation (coords-longitude location)]
        [right-ascention (calc-right-ascention)])
    (get-nasa-image declintation right-asenction)))

;(-> Real)
; Calculates the right ascention for the space that is above you right now.
;(define 


