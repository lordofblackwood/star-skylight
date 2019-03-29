#lang racket/base
(require "geo-locate.rkt"
         nat-traversal)

(best-interface-ip-address)
(get-coords (best-interface-ip-address))
