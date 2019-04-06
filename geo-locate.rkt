#lang racket/base
(require geoip)
(require racket/list)
(require "../racket-nat-traversal/main.rkt")

(provide get-coords)
(provide get-this-coords)

(define geoip (make-geoip "./GeoLite2-City.mmdb"))

(define (get-coords ip)
  (let ([geo-info (hash-ref (geoip-lookup geoip ip) "location")])
    (list (hash-ref geo-info "latitude") 
          (hash-ref geo-info "longitude"))))

(define (get-this-coords)
  (get-coords (best-interface-ip-address)))
