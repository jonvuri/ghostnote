#!/usr/bin/env ruby
# frozen_string_literal: true

# Build a deterministic public-method inventory from one Bitwig API artifact.
# The report keeps the complete type and method counts. It emits only relevant
# signatures, so the saved evidence stays small.

require 'digest'
require 'json'
require 'open3'
require 'optparse'

KEYWORDS = %w[
  action arranger bounce browser callback clipboard clip command content data
  document drag drop event export file import midi note observer output input
  play project record save serial stream track transfer transport
].freeze

options = { api: nil, product: nil }
OptionParser.new do |parser|
  parser.banner = 'Usage: controller_api_inventory.rb --jar PATH [options]'
  parser.on('--jar PATH', 'Exact extension-api jar') { |value| options[:jar] = value }
  parser.on('--api VERSION', 'Declared Controller API version') { |value| options[:api] = value }
  parser.on('--product VERSION', 'Installed Bitwig Studio version') do |value|
    options[:product] = value
  end
end.parse!

abort 'missing --jar PATH' unless options[:jar]

jar_path = File.expand_path(options[:jar])
abort "jar does not exist: #{jar_path}" unless File.file?(jar_path)

def capture!(*command)
  stdout, stderr, status = Open3.capture3(*command)
  abort "command failed: #{command.join(' ')}\n#{stderr}" unless status.success?
  stdout
end

def remove_generics(text)
  depth = 0
  text.each_char.map do |character|
    depth += 1 if character == '<'
    keep = depth.zero?
    depth -= 1 if character == '>'
    character if keep && character != '>'
  end.compact.join
end

entries = capture!('jar', 'tf', jar_path).lines.map(&:strip)
types = entries.grep(%r{^com/bitwig/.+\.class$})
               .reject { |entry| entry.match?(/\$\d+\.class$/) }
               .map { |entry| entry.delete_suffix('.class').tr('/', '.') }
               .sort

inventory = {}
types.each do |type|
  output = capture!('javap', '-classpath', jar_path, '-public', type)
  declaration = output.lines.map(&:strip).find do |line|
    line.match?(/^public (?:abstract |final )?(?:class|interface|enum) /)
  end
  abort "missing declaration for #{type}" unless declaration

  plain_declaration = remove_generics(declaration)
  inheritance = plain_declaration.split(/\b(?:extends|implements)\b/, 2)[1].to_s
  parents = inheritance.scan(/com\.bitwig\.[A-Za-z0-9_.$]+/).uniq
  methods = output.lines.map(&:strip).select do |line|
    line.start_with?('public ') && line.include?('(') && line.end_with?(';')
  end.reject do |line|
    line.match?(/^public #{Regexp.escape(type)}\(/)
  end
  inventory[type] = {
    'declaration' => declaration,
    'parents' => parents.sort,
    'declared_methods' => methods.sort
  }
end

public_methods = {}
resolve = lambda do |type, stack = []|
  return public_methods.fetch(type) if public_methods.key?(type)
  abort "inheritance cycle: #{(stack + [type]).join(' -> ')}" if stack.include?(type)

  entry = inventory.fetch(type)
  inherited = entry['parents'].map do |parent|
    resolve.call(parent, stack + [type]) if inventory.key?(parent)
  end.compact.flatten
  public_methods[type] = (entry['declared_methods'] + inherited).uniq.sort
end
types.each { |type| resolve.call(type) }

keyword_pattern = /#{KEYWORDS.join('|')}/i
relevant = inventory.map do |type, entry|
  declared_hits = entry['declared_methods'].grep(keyword_pattern)
  inherited_hits = public_methods.fetch(type).grep(keyword_pattern) - declared_hits
  next unless type.match?(keyword_pattern) || declared_hits.any? || inherited_hits.any?

  {
    'type' => type,
    'declaration' => entry['declaration'],
    'declared_hits' => declared_hits,
    'inherited_hits' => inherited_hits
  }
end.compact

report = {
  'schema' => 'ghostnote/controller-api-inventory/1',
  'artifact' => {
    'path' => jar_path,
    'bytes' => File.size(jar_path),
    'sha256' => Digest::SHA256.file(jar_path).hexdigest,
    'controller_api' => options[:api],
    'bitwig_studio' => options[:product]
  }.compact,
  'scope' => {
    'packages' => 'com.bitwig.*',
    'includes_inherited_public_methods' => true,
    'keywords' => KEYWORDS,
    'type_count' => types.length,
    'callback_type_count' => types.count { |type| type.start_with?('com.bitwig.extension.callback.') },
    'declared_method_count' => inventory.values.sum { |entry| entry['declared_methods'].length },
    'inherited_expanded_method_count' => public_methods.values.sum(&:length),
    'relevant_type_count' => relevant.length
  },
  'relevant_surface' => relevant
}

puts JSON.pretty_generate(report)
