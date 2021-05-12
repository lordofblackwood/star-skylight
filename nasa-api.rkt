#lang racket/base
(require net/url
         racket/port
         racket/draw
         racket/gui
         json)

(provide get-nasa-image) 


;; (-> String String Bitmap)
;; Given a pair of coordinates in the J2000 coordinate system
;; return an image of the sky centered around those coordinates.
(define (get-nasa-image ra dec)
  (let* ([base-url    "https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl?"]
         [position    (string-append "position=" ra "," dec)]
         [survey      "survey=digitized+sky+survey"]
         [return      "return=png"]
         [nasa-url    (string-append base-url position "&" survey "&" return)]
         [nasa-image  (get-pure-port (string->url nasa-url))])
    (display nasa-url)
    (display "\n")
    ;(display-pure-port nasa-image)
    ;(display "\n")
    ;(png? (port->bytes nasa-image))))
    (read-bitmap nasa-image)))



