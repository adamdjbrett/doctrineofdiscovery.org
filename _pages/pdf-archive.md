---
title: PDF Archive Index
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
