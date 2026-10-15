# frozen_string_literal: true

module Jekyll
  module SeoMetaDescriptions
    MIN_LENGTH = 150
    MAX_LENGTH = 160
    CONTEXT_SENTENCE = "Explore historical documents, analysis, and updates on the Doctrine of Discovery and its continuing impact on Indigenous peoples, law, and society."

    module_function

    def normalize_text(value)
      return "" if value.nil?

      text = value.to_s
      text = text.gsub(/<[^>]+>/, " ")
      text = text.gsub(/\{\{[^}]+\}\}/, " ")
      text = text.gsub(/\{%[^%]+%\}/, " ")
      text = text.gsub(/\[[^\]]+\]\([^)]+\)/, "\\1")
      text = text.gsub(/[`*_>#-]/, " ")
      text = text.gsub(/\s+/, " ").strip
      text
    end

    def strip_trailing_punctuation(value)
      value.to_s.gsub(/[.,;:!\?\s]+$/, "")
    end

    def clamp_to_word_boundary(value, max_len)
      words = normalize_text(value).split(" ").reject(&:empty?)
      best = +""

      words.each do |word|
        candidate = best.empty? ? word : "#{best} #{word}"
        break if candidate.length > max_len

        best = candidate
      end

      strip_trailing_punctuation(best)
    end

    def expand_description(base_text)
      base = strip_trailing_punctuation(normalize_text(base_text))
      base = "Doctrine of Discovery Project resource" if base.empty?
      "#{base}. #{CONTEXT_SENTENCE}"
    end

    def fit_description(value)
      text = normalize_text(value)
      return text if text.length.between?(MIN_LENGTH, MAX_LENGTH)

      if text.length > MAX_LENGTH
        clamped = clamp_to_word_boundary(text, MAX_LENGTH)
        return clamped unless clamped.empty?
      end

      expanded = expand_description(text)
      if expanded.length > MAX_LENGTH
        clamped = clamp_to_word_boundary(expanded, MAX_LENGTH)
        return clamped unless clamped.empty?
      elsif expanded.length >= MIN_LENGTH
        return expanded
      end

      padded = "#{strip_trailing_punctuation(expanded)}. Learn more at doctrineofdiscovery.org."
      clamped = clamp_to_word_boundary(padded, MAX_LENGTH)
      return clamped unless clamped.empty?

      strip_trailing_punctuation(expanded)[0, MAX_LENGTH]
    end

    def preferred_source(doc)
      title = normalize_text(doc.data["title"])
      description = normalize_text(doc.data["description"])
      excerpt = normalize_text(doc.data["excerpt"])
      content = normalize_text(doc.content)

      return description unless description.empty?
      return excerpt unless excerpt.empty?
      return "#{title}. #{content}" unless title.empty? || content.empty?
      return title unless title.empty?

      content
    end

    def html_output?(doc)
      path = doc.respond_to?(:url) ? doc.url.to_s : ""
      return false if path.empty?

      !path.end_with?(".xml", ".json", ".txt")
    end
  end
end

Jekyll::Hooks.register [:pages, :posts, :documents], :pre_render do |doc, _payload|
  next unless Jekyll::SeoMetaDescriptions.html_output?(doc)
  # Keep the author's text for listings (archive-single.html); only <meta> gets the padded version.
  doc.data["front_matter_description"] ||= doc.data["description"].to_s
  next if doc.data["seo_description_lock"] == true
  next if doc.data["description"].is_a?(String) && doc.data["description"].strip.length >= Jekyll::SeoMetaDescriptions::MIN_LENGTH

  source = Jekyll::SeoMetaDescriptions.preferred_source(doc)
  next if source.to_s.strip.empty?

  doc.data["description"] = Jekyll::SeoMetaDescriptions.fit_description(source)
end
