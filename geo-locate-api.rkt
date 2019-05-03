#lang racket/base
(require net/url
         json
         "config.rkt") 

(provide coords)

(define base-url "https://www.googleapis.com/geolocation/v1/geolocate?key=")
(define geo-url (string->url (string-append base-url API-KEY)))

(define coords
  (let ([geo-info (read-json (post-pure-port geo-url #""))])
    (list (hash-ref geo-info "latitude") 
          (hash-ref geo-info "longitude"))))

