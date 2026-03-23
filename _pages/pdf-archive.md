---
title: PDF Archive Index
layout: single
description: "Browse the Doctrine of Discovery PDF archive index with downloadable documents, reports, teaching resources, and reference materials for research and education."
author_profile: false
permalink: /pdf-archive/
suggestedcitiation: false
redirect_from:
  - /pdf/
---
## PDF Archive

<!-- more -->

{% assign pdf_files = site.static_files | where: "pdf", true %}
{% for mypdf in pdf_files %}
  [⤓ {{mypdf.name}}]({{ mypdf.path }})
{% endfor %}
