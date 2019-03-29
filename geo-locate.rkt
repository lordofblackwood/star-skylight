#lang racket/base
(require geoip)
(require racket/string)
(require racket/pretty)
(require racket/port)
(require racket/system)
(require racket/list)
(require "../racket-nat-traversal/main.rkt")

(provide get-coords)

(define geoip (make-geoip "GeoLite2-City.mmdb"))

;(private-ip-address? (best-interface-ip-address))

(define (interface-ip-addresses)
  (filter (lambda (x) x) (flatten (map
   (lambda (pieces)
      (map (lambda (s) (regexp-match #px"(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))"s)) pieces))
   (filter (lambda (r) (and (pair? r) (string-ci=? (car r) "inet6")))
       (map string-split
        (string-split (with-output-to-string (lambda () (system "ifconfig"))) "\n")))))))

(interface-ip-addresses)
(define my-ip "2601:182:cd00:1909:303d:bfa9:8ff1:78e3")
(define an-ip "2601:182:cd00:1909:c3e:ee19:7001:3b61")
(define (get-coords ip)
  (list (hash-ref (hash-ref (geoip-lookup geoip ip) "location") "latitude") 
        (hash-ref (hash-ref (geoip-lookup geoip ip) "location") "longitude")))

(get-coords my-ip)
(get-coords an-ip)
