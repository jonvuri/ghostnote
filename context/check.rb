#!/usr/bin/env ruby
# Validates the active context graph. Archived prose is intentionally frozen.

root = File.expand_path(__dir__)
files = Dir.glob(File.join(root, "**/*.md")).reject { |path| path.include?("/archive/") }
errors = []

files.each do |path|
  text = File.read(path)
  relative = path.delete_prefix(root + "/")

  unless text.start_with?("---\n") && text.match?(/\n---\n/)
    errors << "#{relative}: missing YAML frontmatter"
  end

  text.scan(/\[[^\]]*\]\(([^)#]+)(?:#[^)]*)?\)/).flatten.each do |target|
    next if target.match?(%r{\A(?:https?:|mailto:)})
    resolved = File.expand_path(target, File.dirname(path))
    errors << "#{relative}: broken link #{target}" unless File.exist?(resolved)
  end
end

active_sessions = Dir.glob(File.join(root, "plan/phase-1/*.md")).reject do |path|
  File.basename(path) == "README.md"
end.select do |path|
  File.read(path).match?(/^state: active$/)
end
errors << "expected one active Phase 1 session, found #{active_sessions.length}" unless active_sessions.length == 1

if errors.empty?
  puts "context check passed: #{files.length} active documents, links intact"
else
  warn errors.join("\n")
  exit 1
end
