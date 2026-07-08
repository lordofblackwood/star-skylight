#lang racket/base
(require net/url
         racket/port
         racket/draw)

(provide get-nasa-image
         get-nasa-image-url)


;; (-> String String Bitmap)
;; Given a pair of coordinates in the J2000 coordinate system
;; return an image of the sky centered around those coordinates.
(define (get-nasa-image-url ra dec)
  (let* ([base-url    "https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl?"]
         [position    (string-append "position=" ra "," dec)]
         [survey      "survey=digitized+sky+survey"]
         [scaling     "scaling=linear"]
         [return      "return=png"])
    (string-append base-url position "&" survey "&" scaling "&" return)))

(define (get-nasa-image ra dec)
  (let* ([nasa-url    (get-nasa-image-url ra dec)]
         [nasa-image  (get-pure-port (string->url nasa-url))])
    (display nasa-url)
    (display "\n")
    (read-bitmap nasa-image)))

