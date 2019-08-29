#lang racket/base
(require "geo-locate-api.rkt"
         )


(define latitude (first coords))
(define longitude (first coords))

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

(define RIGHT-ASCENSION )

(define init-local-noon )
(define final-local-noon )
(define aprox-time )
(define sun-init-ra )
(define sun-final-ra )

