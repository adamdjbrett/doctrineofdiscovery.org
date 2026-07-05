require "json"

module Jekyll
  class PostMetadataJsonPage < PageWithoutAFile
    def initialize(site, post)
      @site = site
      @base = site.source
      @dir = post.url.sub(%r!^/!, "").sub(%r!/+$!, "")
      @name = "metadata.json"
      process(@name)
      self.data = { "layout" => nil, "sitemap" => false }
      self.content = JSON.pretty_generate(PostMetadataJsonGenerator.schema_for(site, post))
    end
  end

  class PostMetadataJsonGenerator < Generator
    safe true
    priority :low

    def generate(site)
      site.posts.docs.each do |post|
        next if post.data["published"] == false
        site.pages << PostMetadataJsonPage.new(site, post)
      end
    end

    def self.schema_for(site, post)
      site_url = site.config["url"].to_s.sub(%r!/$!, "")
      canonical_url = post.data["canonical_url"] || "#{site_url}#{post.url}"
      title = post.data["title"] || site.config["title"]
      description = post.data["description"] || strip_html(post.data["excerpt"] || post.excerpt || site.config["description"])
      author_name = author_name(site, post.data["author"])
      language = site.config["locale"].to_s[0, 2]
      image = post.data["image"] || post.data["header"]&.dig("image") || site.config["teaser"] || site.config["logo"]
      image_url = absolute_url(site_url, image)

      schema = {
        "@context" => "https://schema.org",
        "@type" => "BlogPosting",
        "@id" => "#{canonical_url}#article",
        "name" => title,
        "headline" => title,
        "description" => description.to_s.strip,
        "url" => canonical_url,
        "inLanguage" => language.empty? ? "en" : language,
        "identifier" => post.data["doi"] || post.data["canonical_url"] || "#{site_url}#{post.url}",
        "datePublished" => date_iso(post.date),
        "dateModified" => date_iso(post.data["last_modified_at"] || post.date),
        "author" => {
          "@type" => "Person",
          "name" => author_name
        },
        "publisher" => {
          "@type" => "Organization",
          "name" => site.config["title"],
          "url" => site_url
        },
        "isPartOf" => {
          "@type" => "Blog",
          "@id" => "#{site_url}/blog/",
          "name" => site.config["title"],
          "url" => "#{site_url}/blog/"
        }
      }
      schema["image"] = image_url if image_url
      schema["citation"] = post.data["citations"] if post.data["citations"]
      schema
    end

    def self.author_name(site, author_key)
      return site.config.dig("author", "name") || site.config["title"] unless author_key
      author_doc = site.collections["authors"]&.docs&.find { |doc| doc.data["username"] == author_key || doc.data["slug"] == author_key }
      author_doc&.data&.fetch("name", nil) || author_key.to_s.split("-").map(&:capitalize).join(" ")
    end

    def self.absolute_url(site_url, value)
      return nil if value.to_s.empty?
      return value if value.to_s.start_with?("http://", "https://")
      "#{site_url}/#{value.to_s.sub(%r!^/!, "")}"
    end

    def self.date_iso(value)
      value.respond_to?(:strftime) ? value.strftime("%Y-%m-%d") : value.to_s
    end

    def self.strip_html(value)
      value.to_s.gsub(/<[^>]*>/, " ").gsub(/\s+/, " ")
    end
  end
end
