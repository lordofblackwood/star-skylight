#lang racket/base
(require net/url
         json
         racket/list
         "geo-locate-api.rkt") 

(provide solar-noon)

(define base-url "https://api.sunrise-sunset.org/json?")

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

;(solar-noon (first coords) (second coords) "today")
