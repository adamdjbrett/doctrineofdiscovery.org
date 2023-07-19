---
ID: 8875
title: "2014 Conference Photo Gallery"
author: Indigenous-Values-Initiative
excerpt: "2014 conference photo gallery"
permalink: /2014-conference-photo-gallery/
published: true
date: 2018-07-26T11:45:17
categories:
  - Event
tags:
  - photos
---
<!--more-->

{% for image in site.static_files %}
  {% if image.path contains 'assets/images/2014-conf' %}
  <img src="{{ image.path }}" alt="2014 event photos"> 

  {% endif %}
{% endfor %}
