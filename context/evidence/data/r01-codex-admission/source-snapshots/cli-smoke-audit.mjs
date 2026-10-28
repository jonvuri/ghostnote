// Provider totals have different cache semantics. Preserve raw counters as well.
export function auditTranscript(provider, events) {
  const completion = events.findLast(e => e.type === 'turn.completed' || e.type === 'result');
  const usage = completion?.usage;
  const items = events.filter(e => e.type?.startsWith('item.') && e.item).map(e => e.item);
  const notices = items.filter(i => i.type === 'error').map(i => i.message);
  const unknownItems = items.filter(i => !['error', 'agent_message', 'reasoning',
    'command_execution', 'mcp_tool_call', 'web_search', 'file_change'].includes(i.type));
  const toolEventCount = items.filter(i => ['command_execution', 'mcp_tool_call',
    'web_search', 'file_change'].includes(i.type)).length
    + events.filter(e => e.message?.content?.some(c => c.type === 'tool_use')).length;
  const errors = events.filter(e => ['error', 'turn.failed'].includes(e.type));
  const init = events.find(e => e.type === 'system' && e.subtype === 'init');
  const models = [...new Set([init?.model, ...events.map(e => e.message?.model),
    ...Object.keys(completion?.modelUsage ?? {})].filter(Boolean))];
  const allowedNotice = s => s.startsWith('Under-development features enabled: skip_host_skill_discovery.');
  return {
    toolEventCount, unknownItemCount: unknownItems.length, notices,
    transportClean: Boolean(completion && usage && toolEventCount === 0
      && unknownItems.length === 0 && errors.length === 0 && !completion.is_error
      && notices.every(allowedNotice)),
    reportedModelAvailable: models.length > 0,
    // OpenAI cached input is INCLUDED in input_tokens. Anthropic caches are ADDITIVE.
    totalInputTokens: usage ? (provider === 'codex' ? usage.input_tokens
      : usage.input_tokens + (usage.cache_creation_input_tokens ?? 0)
        + (usage.cache_read_input_tokens ?? 0)) : null,
    finalOutputTokens: usage?.output_tokens ?? null,
    initializedPlugins: init?.plugins?.map(p => ({ name: p.name, source: p.source })) ?? null,
    advertisedMcpServers: init?.mcp_servers ?? null,
    overageUsed: events.findLast(e => e.type === 'rate_limit_event')
      ?.rate_limit_info?.isUsingOverage ?? null,
  };
}
