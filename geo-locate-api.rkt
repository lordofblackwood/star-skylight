#lang racket/base
(require net/url
         json
         "config.rkt") 

(provide LOCATION 
         (struct-out coords))

(struct coords [latitude longitude] #:transparent)
(define base-url "https://www.googleapis.com/geolocation/v1/geolocate?key=")
(define geo-url (string->url (string-append base-url API-KEY)))

(define LOCATION
  (let* ([geo-info   (read-json (post-pure-port geo-url #""))]
         [location   (hash-ref geo-info 'location)]
         [lat        (hash-ref location 'lat)]
         [long       (hash-ref location 'lng)])
    (coords lat long)))

