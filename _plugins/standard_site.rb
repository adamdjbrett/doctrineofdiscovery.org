# frozen_string_literal: true

require 'cgi'
require 'json'
require 'time'

module DoctrineStandardSite
  CORE_PAGE_URLS = %w[
    /about/
    /law/
    /papal-bulls/
    /faith-communities/
    /bibliography/
    /online-resources/
    /united-nations/
    /pdf-archive/
    /featured/
    /canopy/
  ].freeze

  module_function

  def enabled?(site)
    site.config.dig('standard_site', 'enabled') == true
  end

  def site_url(site)
    (site.config.dig('standard_site', 'url') || site.config['url']).to_s.sub(%r{/+\z}, '')
  end

  def publication_site(site)
    at_uri = site.config.dig('standard_site', 'publication_at_uri').to_s.strip
    at_uri.empty? ? site_url(site) : at_uri
  end

  def publication(site)
    config = site.config['standard_site'] || {}
    record = {
      '$type' => 'site.standard.publication',
      'name' => config['name'].to_s.strip.empty? ? site.config['title'].to_s : config['name'].to_s,
      'url' => site_url(site),
      'description' => config['description'].to_s.strip.empty? ? site.config['description'].to_s : config['description'].to_s
    }
    record['did'] = config['did'].to_s.strip unless config['did'].to_s.strip.empty?
    record['atUri'] = config['publication_at_uri'].to_s.strip unless config['publication_at_uri'].to_s.strip.empty?
    record
  end

  def selected_documents(site)
    docs = site.posts.docs.select { |doc| published?(doc) }
    pages = site.pages.select { |page| CORE_PAGE_URLS.include?(normalize_path(page.url)) && published?(page) }
    (docs + pages).map { |doc| document_record(site, doc) }.compact.sort_by { |record| record['path'] }
  end

  def published?(doc)
    doc.data['published'] != false && doc.data['draft'] != true
  end

  def normalize_path(path)
    clean = path.to_s.split('?').first.to_s.split('#').first
    clean = "/#{clean}" unless clean.start_with?('/')
    clean.end_with?('/') ? clean : "#{clean}/"
  end

  def document_record(site, doc)
    path = normalize_path(doc.url)
    source_date = doc.data['date'] || (doc.respond_to?(:date) ? doc.date : nil)
    published_at = normalize_date(source_date || doc.data['last_modified_at'] || site.time)
    title = plain_text(doc.data['title']).empty? ? path : plain_text(doc.data['title'])
    description = plain_text(doc.data['description'] || doc.data['excerpt'])
    body = plain_text(doc.content)

    record = {
      '$type' => 'site.standard.document',
      'site' => publication_site(site),
      'path' => path,
      'title' => title,
      'publishedAt' => published_at
    }
    record['description'] = description unless description.empty?
    updated_at = normalize_date(doc.data['last_modified_at'] || doc.data['modified'] || doc.data['updated'])
    record['updatedAt'] = updated_at if updated_at && updated_at != published_at
    tags = normalize_tags(doc.data['tags']) + normalize_tags(doc.data['categories'])
    record['tags'] = tags.uniq unless tags.empty?
    record['textContent'] = body unless body.empty?
    record['canonicalUrl'] = doc.data['canonical_url'].to_s.strip unless doc.data['canonical_url'].to_s.strip.empty?
    record['externalUrl'] = doc.data['link'].to_s.strip unless doc.data['link'].to_s.strip.empty?
    record
  end

  def normalize_date(value)
    return nil if value.nil?

    time = value.respond_to?(:to_time) ? value.to_time : Time.parse(value.to_s)
    time.utc.iso8601
  rescue StandardError
    nil
  end

  def normalize_tags(value)
    raw = value.is_a?(Array) ? value : value.to_s.split(',')
    raw.map { |item| plain_text(item) }.reject(&:empty?)
  end

  def plain_text(value)
    text = value.to_s.dup
    text.gsub!(/\A---\s*\n.*?\n---\s*/m, ' ')
    text.gsub!(/\{%\s*.*?\s*%\}/m, ' ')
    text.gsub!(/\{\{\s*.*?\s*\}\}/m, ' ')
    text.gsub!(/```.*?```/m, ' ')
    text.gsub!(/`([^`]+)`/, '\1')
    text.gsub!(/!\[[^\]]*\]\([^)]+\)/, ' ')
    text.gsub!(/\[([^\]]+)\]\([^)]+\)/, '\1')
    text.gsub!(/<[^>]+>/, ' ')
    text = CGI.unescapeHTML(text)
    text.gsub!(/^[#>*+\-]+\s*/, '')
    text.gsub!(/[*_~]+/, '')
    text.gsub(/\s+/, ' ').strip
  end

  class JsonPage < Jekyll::PageWithoutAFile
    def initialize(site, dir, name, payload)
      super(site, site.source, dir, name)
      @payload = payload
      self.data['layout'] = nil
    end

    def read_yaml(*)
      @data ||= {}
    end

    def output
      "#{JSON.pretty_generate(@payload)}\n"
    end
  end

  class Generator < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      return unless DoctrineStandardSite.enabled?(site)

      publication = DoctrineStandardSite.publication(site)
      documents = DoctrineStandardSite.selected_documents(site)
      manifest = {
        '$type' => 'site.standard.manifest',
        'publication' => publication,
        'documentCount' => documents.length,
        'documents' => documents.map do |record|
          {
            'path' => record['path'],
            'title' => record['title'],
            'publishedAt' => record['publishedAt']
          }
        end
      }

      site.pages << JsonPage.new(site, 'standard.site', 'publication.json', publication)
      site.pages << JsonPage.new(site, 'standard.site', 'documents.json', documents)
      site.pages << JsonPage.new(site, 'standard.site', 'manifest.json', manifest)
    end
  end
end
