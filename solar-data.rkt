#lang racket/base
(require net/url
         json
         racket/list
         racket/date
         gregor
         "geo-locate-api.rkt") 

(provide solar-noon
         get-sun-ra)

(define base-url "https://api.sunrise-sunset.org/json?")

;; API Call to sunrise-sunset.org to get the solar noon
(define (solar-noon lat long date)
  (let* ([api-url (string->url (string-append
                                base-url
                                "lat="
                                (number->string lat)
                                "&lng="
                                (number->string long)
                                "&date="
                                date))]
        [solar-info (read-json (get-pure-port api-url))])
    (hash-ref (hash-ref solar-info 'results) 'solar_noon)))

;; a date-string is a String in the date format "yyyy-mm-dd"

;; (date-string -> String)
;; Calculations for sun's right ascension
(define (get-sun-ra lng lat date)
  (let* ([date-split (map string->number (string-split date "-"))]
         [todays-date (date (car date-split) (cdar date-split) (cddar date-split))]
         [spring-equinox (date (car date-split) "03" "21")]
         [days-since-equinox (days-between spring-equinox todays-date)])
    (* 24 (modolo days-since-equinox 365))))
  

;(solar-noon (first coords) (second coords) "today")
