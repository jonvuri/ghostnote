#!/usr/bin/env ruby
# Check local Markdown links outside the historical archive.

root = File.expand_path(__dir__)
files = Dir.glob(File.join(root, "**/*.md")).reject { |path| path.include?("/archive/") }
errors = []

files.each do |path|
  text = File.read(path)
  relative = path.delete_prefix(root + "/")

  text.scan(/\[[^\]]*\]\(([^)#]+)(?:#[^)]*)?\)/).flatten.each do |target|
    next if target.match?(%r{\A(?:https?:|mailto:)})
    resolved = File.expand_path(target, File.dirname(path))
    errors << "#{relative}: broken link #{target}" unless File.exist?(resolved)
  end
end

if errors.empty?
  puts "context check passed: #{files.length} documents, links intact"
else
  warn errors.join("\n")
  exit 1
end
