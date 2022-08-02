#lang racket/base
(require net/url
         json
         (prefix-in h: html)
         (prefix-in x: xml)
         racket/list
         racket/date
         racket/string
         racket/match
         gregor
         "geo-locate-api.rkt") 

(provide solar-noon
         get-sun-ra)


;; (Number Number String -> String)
;; API Call to sunrise-sunset.org to get the solar noon
(define (solar-noon lat long date)
  (let* ([base-url "https://api.sunrise-sunset.org/json?"]
         [api-url (string->url (string-append
                                base-url
                                "lat="
                                (number->string lat)
                                "&lng="
                                (number->string long)
                                "&date="
                                date))]
        [solar-info (read-json (get-pure-port api-url))])
    (string-append date " " (hash-ref (hash-ref solar-info 'results) 'solar_noon))))

;; a date-string is a String in the date format "yyyy-mm-dd"

;; (date-string -> Number)
;; Calculations for sun's right ascension
(define (get-sun-ra lng lat string-date)
  (let* ([date-split          (map string->number (string-split string-date "-"))]
         [todays-date         (date (first date-split) (second date-split) (third date-split))]
         [spring-equinox      (date (car date-split) 3 21)]
         [days-since-equinox  (days-between spring-equinox todays-date)])
    (* 360 (/ (modulo days-since-equinox 365) 365))))

; extract-pcdata: html-content/c -> (listof string)
; Pulls out the pcdata strings from some-content.
(define (extract-pcdata some-content)
  (cond [(x:pcdata? some-content)
         (list (x:pcdata-string some-content))]
        [(x:entity? some-content)
         (list)]
        [else
         (extract-pcdata-from-element some-content)]))

; extract-pcdata-from-element: html-element -> (listof string)
; Pulls out the pcdata strings from an-html-element.
(define (extract-pcdata-from-element an-html-element)
  (match an-html-element
    [(struct h:html-full (attributes content))
     (apply append (map extract-pcdata (memf h:pre? content)))]

    [(struct h:html-element (attributes))
     '()]))

#;(display 
  ;(extract-pcdata 
  (filter x:pre? (map x:xml->xexpr
           (h:read-html-as-xml 
             (get-pure-port 
               (string->url "http://people.tamu.edu/~kevinkrisciunas/ra_dec_sun_2022.html")))))) 
