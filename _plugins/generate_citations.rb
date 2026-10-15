# frozen_string_literal: true

require 'fileutils'

module Jekyll
  # Hook to generate citation files after site is written
  Jekyll::Hooks.register :site, :post_write do |site|
    citations_dir = File.join(site.dest, 'assets', 'citations')
    FileUtils.mkdir_p(citations_dir)

    site.posts.docs.each do |post|
      next unless post.data['title'] && post.data['date']

      # Generate slug from URL or fallback to basename
      slug = post.url.split('/').last || File.basename(post.path, '.*')
      
      # Extract metadata
      title = post.data['title']
      date = post.data['date']
      description = (post.data['description'] || post.data['excerpt'] || '').to_s
      url = "#{site.config['url']}#{post.url}"
      tags = post.data['tags'] || []
      categories = post.data['categories'] || []
      author = post.data['author'] || 'Doctrine of Discovery Project'
      
      # Generate RIS file
      ris_content = generate_ris(title, date, url, description, tags, author)
      File.write(File.join(citations_dir, "#{slug}.ris"), ris_content)
      
      # Generate CSL-JSON file
      csl_content = generate_csl_json(title, date, url, description, tags, slug, author)
      File.write(File.join(citations_dir, "#{slug}.csl.json"), csl_content)
    end

    Jekyll.logger.info "Citations:", "Generated citation files for #{site.posts.docs.size} posts"
  end

  def self.generate_ris(title, date, url, description, tags, author)
    lines = []
    lines << "TY  - GEN"
    lines << "TI  - #{title}"
    lines << "AU  - #{author}" if author
    lines << "DA  - #{date.strftime('%Y/%m/%d')}"
    lines << "UR  - #{url}"
    lines << "N1  - #{description.gsub("\n", ' ')}" unless description.empty?
    tags.each { |tag| lines << "KW  - #{tag}" }
    lines << "PB  - Doctrine of Discovery Project"
    lines << "T1  - #{title}"
    lines << "ER  -"
    lines.join("\n") + "\n"
  end

  def self.generate_csl_json(title, date, url, description, tags, slug, author)
    issued = {
      'date-parts' => [[date.year, date.month, date.day]]
    }
    
    obj = {
      'id' => slug,
      'type' => 'post-weblog',
      'title' => title,
      'abstract' => description.gsub("\n", ' '),
      'URL' => url,
      'language' => 'en',
      'source' => 'Doctrine of Discovery Project',
      'issued' => issued
    }
    
    obj['author'] = [{'literal' => author}] if author
    obj['keyword'] = tags if tags.any?
    
    require 'json'
    JSON.pretty_generate([obj]) + "\n"
  end
end
